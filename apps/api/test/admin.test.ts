import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/credentials.js';
import { call, login, setupTeacher } from './helpers.js';

async function setupAdmin() {
  const account = await prisma.account.create({ data: {
    login: `admin.${randomUUID().slice(0, 8)}`, role: 'ADMIN', passwordHash: await hashPassword('admin-test-123'),
    admin: { create: { name: 'Директор школы' } },
  } });
  return { cookie: await login(account.login, 'admin-test-123'), account };
}

describe('администратор школы', () => {
  it('отдельная роль: вход, защита от остальных ролей и CSRF', async () => {
    const admin = await setupAdmin();
    expect((await call('GET', '/api/auth/me', { cookie: admin.cookie })).body.user).toMatchObject({ role: 'ADMIN', name: 'Директор школы' });
    expect((await call('GET', '/api/admin/teachers')).status).toBe(401);
    const t = await setupTeacher();
    const parent = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
    const cookies = [t.cookie, await t.studentCookie(0), await login(parent.login, parent.password)];
    for (const cookie of cookies) {
      expect((await call('GET', '/api/admin/teachers', { cookie })).status).toBe(403);
      expect((await call('GET', '/api/admin/groups', { cookie })).status).toBe(403);
      expect((await call('POST', `/api/admin/teachers/${t.teacher.id}/reset-password`, { cookie })).status).toBe(403);
      expect((await call('POST', '/api/admin/teachers', { cookie, body: { name: 'Нельзя', login: 'forbidden' } })).status).toBe(403);
      expect((await call('PUT', `/api/admin/teachers/${t.teacher.id}/premium`, { cookie, body: { until: null } })).status).toBe(403);
    }
    expect((await call('GET', '/api/teacher/groups', { cookie: admin.cookie })).status).toBe(403);
    expect((await call('POST', '/api/admin/teachers', { cookie: admin.cookie, body: { name: 'x', login: 'xxx' }, noClientHeader: true })).status).toBe(403);
  });

  it('создаёт преподавателя, логины уникальны, список не раскрывает пароли', async () => {
    const admin = await setupAdmin();
    const loginName = `teacher.${randomUUID().slice(0, 8)}`;
    const created = await call('POST', '/api/admin/teachers', { cookie: admin.cookie, body: { name: '  Анна Ивановна  ', login: loginName.toUpperCase() } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Анна Ивановна', login: loginName });
    expect(created.body.password.length).toBeGreaterThanOrEqual(8);
    const teacherCookie = await login(created.body.login, created.body.password);
    expect((await call('GET', '/api/auth/me', { cookie: teacherCookie })).body.user.role).toBe('TEACHER');
    expect((await call('POST', '/api/admin/teachers', { cookie: admin.cookie, body: { name: 'Другая', login: loginName } })).status).toBe(409);
    expect((await call('POST', '/api/admin/teachers', { cookie: admin.cookie, body: { name: '', login: 'русский' } })).status).toBe(400);
    const rows = (await call('GET', '/api/admin/teachers', { cookie: admin.cookie })).body.teachers;
    expect(rows.find((t: { id: string }) => t.id === created.body.id)).toMatchObject({ ownedGroups: 0, sharedGroups: 0 });
    expect(JSON.stringify(rows)).not.toMatch(/password|Hash/);
  });

  it('новый пароль завершает все сеансы преподавателя, не трогая остальные входы', async () => {
    const admin = await setupAdmin();
    const t = await setupTeacher();
    const account = await prisma.account.findUniqueOrThrow({ where: { id: t.teacher.accountId } });
    const second = await login(account.login, 'teacher-pass-123');
    const student = await t.studentCookie(0);
    const reset = await call('POST', `/api/admin/teachers/${t.teacher.id}/reset-password`, { cookie: admin.cookie });
    expect(reset.status).toBe(200);
    for (const cookie of [t.cookie, second]) expect((await call('GET', '/api/teacher/groups', { cookie })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { body: { login: account.login, password: 'teacher-pass-123' } })).status).toBe(401);
    expect((await call('GET', '/api/teacher/groups', { cookie: await login(account.login, reset.body.password) })).status).toBe(200);
    expect((await call('GET', '/api/student/profile', { cookie: student })).status).toBe(200);
    expect((await call('GET', '/api/admin/teachers', { cookie: admin.cookie })).status).toBe(200);
    expect((await call('POST', '/api/admin/teachers/missing/reset-password', { cookie: admin.cookie })).status).toBe(404);
  });

  it('показывает владельца, соавторов и архивные группы всей школы', async () => {
    const admin = await setupAdmin();
    const owner = await setupTeacher(['Маша Иванова']);
    const colleague = await setupTeacher(['Свой Ученик']);
    await prisma.groupTeacher.create({ data: { groupId: owner.group.id, teacherId: colleague.teacher.id } });
    await prisma.group.update({ where: { id: owner.group.id }, data: { archivedAt: new Date() } });
    const groups = (await call('GET', '/api/admin/groups', { cookie: admin.cookie })).body;
    expect(groups.find((g: { id: string }) => g.id === owner.group.id)).toMatchObject({
      owner: { id: owner.teacher.id }, colleagues: [{ id: colleague.teacher.id }], studentsCount: 1, archivedAt: expect.any(String),
    });
  });

  it('управляет сроком премиума и проверяет календарную дату', async () => {
    const admin = await setupAdmin();
    const t = await setupTeacher();
    const path = `/api/admin/teachers/${t.teacher.id}/premium`;
    const year = new Date().getFullYear() + 1;
    expect((await call('PUT', path, { cookie: admin.cookie, body: { until: `${year}-06-30` } })).body).toMatchObject({ premiumActive: true, freeForAll: false, premiumUntil: `${year}-06-30T20:59:59.999Z` });
    expect((await call('PUT', path, { cookie: admin.cookie, body: { until: `${year}-02-30` } })).status).toBe(400);
    expect((await call('PUT', path, { cookie: admin.cookie, body: { until: '2000-01-01' } })).status).toBe(400);
    expect((await call('PUT', path, { cookie: admin.cookie, body: { until: null } })).body.premiumActive).toBe(false);
  });

  it('меняет свой пароль: нужен текущий, другие устройства выходят, текущая сессия живёт', async () => {
    const admin = await setupAdmin();
    const other = await login(admin.account.login, 'admin-test-123');
    const wrong = await call('POST', '/api/admin/me/password', { cookie: admin.cookie, body: { currentPassword: 'neverno', newPassword: 'new-admin-pass' } });
    expect(wrong.status).toBe(400);

    const changed = await call('POST', '/api/admin/me/password', { cookie: admin.cookie, body: { currentPassword: 'admin-test-123', newPassword: 'new-admin-pass' } });
    expect(changed.status).toBe(200);
    expect((await call('GET', '/api/admin/teachers', { cookie: admin.cookie })).status).toBe(200);
    expect((await call('GET', '/api/admin/teachers', { cookie: other })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { body: { login: admin.account.login, password: 'admin-test-123' } })).status).toBe(401);
    await login(admin.account.login, 'new-admin-pass');

    const t = await setupTeacher();
    const forbidden = await call('POST', '/api/admin/me/password', { cookie: t.cookie, body: { currentPassword: 'x', newPassword: 'new-admin-pass' } });
    expect(forbidden.status).toBe(403);
  });
});
