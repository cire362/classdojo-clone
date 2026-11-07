import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { SchoolRole } from '../src/generated/prisma/client';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

const uid = () => randomUUID().slice(0, 8);

/** Школа с директором; остальных сотрудников добавляет staff() */
async function setupSchool(name = 'Северная школа') {
  const school = await prisma.school.create({ data: { name } });
  const staff = async (role: SchoolRole) => {
    const loginName = `staff.${uid()}`;
    const admin = await prisma.admin.create({
      data: {
        name: `${role} ${name}`, role, school: { connect: { id: school.id } },
        account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
      },
    });
    return { id: admin.id, cookie: await login(loginName, 'staff-test-123') };
  };
  return { school, director: await staff('DIRECTOR'), staff };
}

const joinBody = (code: string, loginName = `t.${uid()}`) => ({
  code, name: 'Анна Петровна', login: loginName, password: 'teacher-pass-1',
});

it('сотрудник только смотрит; завуч ведёт преподавателей и выгрузку; название и администрацию меняет директор', async () => {
  const s = await setupSchool();
  const deputy = await s.staff('DEPUTY');
  const clerk = await s.staff('STAFF');
  const t = await setupTeacher(['Маша Иванова'], s.school.id);
  const newTeacher = () => ({ name: 'Коллега', login: `t.${uid()}` });

  for (const who of [clerk, deputy, s.director]) {
    for (const path of ['/api/admin/teachers', '/api/admin/groups', '/api/admin/staff', '/api/admin/school']) {
      expect((await call('GET', path, { cookie: who.cookie })).status).toBe(200);
    }
  }
  expect((await call('GET', '/api/admin/school', { cookie: clerk.cookie })).body).toMatchObject({ role: 'STAFF', joinCode: null });
  const denied = await call('POST', '/api/admin/teachers', { cookie: clerk.cookie, body: newTeacher() });
  expect(denied).toMatchObject({ status: 403, body: { error: 'Это может сделать только руководитель или его заместитель' } });
  expect((await call('POST', `/api/admin/teachers/${t.teacher.id}/reset-password`, { cookie: clerk.cookie })).status).toBe(403);
  expect((await call('GET', `/api/admin/groups/${t.group.id}/export`, { cookie: clerk.cookie })).status).toBe(403);
  expect((await call('POST', '/api/admin/join-code', { cookie: clerk.cookie })).status).toBe(403);
  expect((await call('GET', '/api/admin/teacher-requests', { cookie: clerk.cookie })).status).toBe(403);

  expect((await call('POST', '/api/admin/teachers', { cookie: deputy.cookie, body: newTeacher() })).status).toBe(201);
  expect((await call('GET', `/api/admin/groups/${t.group.id}/export`, { cookie: deputy.cookie })).status).toBe(200);
  expect((await call('PATCH', '/api/admin/school', { cookie: deputy.cookie, body: { name: 'Завуч' } })).status).toBe(403);
  const staffBody = { name: 'Секретарь', login: `s.${uid()}`, role: 'STAFF' };
  const byDeputy = await call('POST', '/api/admin/staff', { cookie: deputy.cookie, body: staffBody });
  expect(byDeputy.body.error).toBe('Это может сделать только руководитель');
  expect((await call('PATCH', '/api/admin/school', { cookie: s.director.cookie, body: { name: 'Гимназия' } })).body.name).toBe('Гимназия');
});

it('директор добавляет сотрудников, меняет должности и входы; себя изменить нельзя, другая школа недоступна', async () => {
  const s = await setupSchool();
  const other = await setupSchool('Южная школа');
  const body = { name: 'Ольга', login: `o.${uid()}`, role: 'DEPUTY' };
  const created = await call('POST', '/api/admin/staff', { cookie: s.director.cookie, body });
  expect(created.status).toBe(201);
  const olga = await login(created.body.login, created.body.password);
  expect((await call('GET', '/api/admin/school', { cookie: olga })).body.role).toBe('DEPUTY');

  const staff = (await call('GET', '/api/admin/staff', { cookie: s.director.cookie })).body;
  expect(staff.map((m: { name: string; role: string; isMe: boolean }) => [m.name, m.role, m.isMe])).toEqual([
    ['DIRECTOR Северная школа', 'DIRECTOR', true],
    ['Ольга', 'DEPUTY', false],
  ]);
  const roleOf = (id: string, cookie = s.director.cookie) =>
    call('PUT', `/api/admin/staff/${id}/role`, { cookie, body: { role: 'STAFF' } });
  expect((await roleOf(created.body.id)).body[1].role).toBe('STAFF');
  // Права меняются сразу, без нового входа
  expect((await call('POST', '/api/admin/join-code', { cookie: olga })).status).toBe(403);
  expect((await roleOf(s.director.id)).status).toBe(400);
  expect((await call('DELETE', `/api/admin/staff/${s.director.id}`, { cookie: s.director.cookie })).status).toBe(400);
  expect((await roleOf(created.body.id, other.director.cookie)).status).toBe(404);
  expect((await call('POST', `/api/admin/staff/${created.body.id}/reset-password`, { cookie: other.director.cookie })).status).toBe(404);
  expect((await call('GET', '/api/admin/staff', { cookie: other.director.cookie })).body).toHaveLength(1);

  const reset = (await call('POST', `/api/admin/staff/${created.body.id}/reset-password`, { cookie: s.director.cookie })).body;
  expect((await call('GET', '/api/admin/school', { cookie: olga })).status).toBe(401);
  const again = await login(reset.login, reset.password);
  expect((await call('DELETE', `/api/admin/staff/${created.body.id}`, { cookie: s.director.cookie })).body).toHaveLength(1);
  expect((await call('GET', '/api/admin/school', { cookie: again })).status).toBe(401);
  expect(await prisma.account.count({ where: { login: created.body.login } })).toBe(0);
});

it('два директора не могут одновременно понизить друг друга: в школе остаётся директор', async () => {
  const s = await setupSchool();
  const second = await s.staff('DIRECTOR');
  const results = await Promise.all([
    call('PUT', `/api/admin/staff/${second.id}/role`, { cookie: s.director.cookie, body: { role: 'STAFF' } }),
    call('PUT', `/api/admin/staff/${s.director.id}/role`, { cookie: second.cookie, body: { role: 'STAFF' } }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 403]);
  expect(await prisma.admin.count({ where: { schoolId: s.school.id, role: 'DIRECTOR' } })).toBe(1);
});

it('преподаватель подключается по коду школы и входит только после проверки', async () => {
  const s = await setupSchool();
  const other = await setupSchool('Южная школа');
  expect((await call('POST', '/api/auth/school-join/preview', { body: { code: 'ABCDEFGH' } })).status).toBe(404);
  const { joinCode } = (await call('POST', '/api/admin/join-code', { cookie: s.director.cookie })).body;
  expect(joinCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  expect((await call('GET', '/api/admin/school', { cookie: s.director.cookie })).body).toMatchObject({ joinCode, pendingTeachers: 0 });

  const typed = `${joinCode.slice(0, 4).toLowerCase()}-${joinCode.slice(4)}`;
  const preview = (await call('POST', '/api/auth/school-join/preview', { body: { code: typed } })).body;
  expect(preview).toEqual({ schoolName: 'Северная школа', kind: 'SCHOOL' });
  const body = joinBody(typed);
  expect((await call('POST', '/api/auth/school-join', { body })).status).toBe(201);
  expect((await call('POST', '/api/auth/school-join', { body: { ...body, login: body.login.toUpperCase() } })).status).toBe(409);
  const pending = await call('POST', '/api/auth/login', { body: { login: body.login, password: body.password } });
  expect(pending).toMatchObject({ status: 403, body: { error: expect.stringContaining('«Северная школа» ещё ждёт проверки') } });
  expect((await call('POST', '/api/auth/login', { body: { login: body.login, password: 'wrong-pass-1' } })).status).toBe(401);

  // До проверки преподаватель не виден в школе и не может стать соавтором
  expect((await call('GET', '/api/admin/teachers', { cookie: s.director.cookie })).body.teachers).toEqual([]);
  const owner = await setupTeacher(['Петя Смирнов'], s.school.id);
  const coTeachers = `/api/teacher/groups/${owner.group.id}/teachers`;
  expect((await call('POST', coTeachers, { cookie: owner.cookie, body: { login: body.login } })).status).toBe(404);

  const [request] = (await call('GET', '/api/admin/teacher-requests', { cookie: s.director.cookie })).body;
  expect(request).toMatchObject({ name: 'Анна Петровна', login: body.login });
  expect((await call('GET', '/api/admin/school', { cookie: s.director.cookie })).body.pendingTeachers).toBe(1);
  expect((await call('GET', '/api/admin/teacher-requests', { cookie: other.director.cookie })).body).toEqual([]);
  expect((await call('POST', `/api/admin/teacher-requests/${request.id}/approve`, { cookie: other.director.cookie })).status).toBe(404);

  const deputy = await s.staff('DEPUTY');
  expect((await call('POST', `/api/admin/teacher-requests/${request.id}/approve`, { cookie: deputy.cookie })).body).toEqual([]);
  expect((await call('POST', '/api/auth/login', { body: { login: body.login, password: body.password } })).status).toBe(200);
  expect((await call('POST', coTeachers, { cookie: owner.cookie, body: { login: body.login } })).status).toBe(200);
  expect((await call('POST', `/api/admin/teacher-requests/${request.id}/approve`, { cookie: deputy.cookie })).status).toBe(404);
});

it('отклонённая заявка удаляется; новый код отменяет старый, выключенный код не работает', async () => {
  const s = await setupSchool();
  const first = (await call('POST', '/api/admin/join-code', { cookie: s.director.cookie })).body.joinCode;
  const body = joinBody(first);
  await call('POST', '/api/auth/school-join', { body });
  const [request] = (await call('GET', '/api/admin/teacher-requests', { cookie: s.director.cookie })).body;
  expect((await call('DELETE', `/api/admin/teacher-requests/${request.id}`, { cookie: s.director.cookie })).body).toEqual([]);
  expect(await prisma.account.count({ where: { login: body.login } })).toBe(0);
  // Логин освободился
  expect((await call('POST', '/api/auth/school-join', { body })).status).toBe(201);

  const second = (await call('POST', '/api/admin/join-code', { cookie: s.director.cookie })).body.joinCode;
  expect(second).not.toBe(first);
  expect((await call('POST', '/api/auth/school-join/preview', { body: { code: first } })).status).toBe(404);
  expect((await call('DELETE', '/api/admin/join-code', { cookie: s.director.cookie })).body).toEqual({ joinCode: null });
  expect((await call('POST', '/api/auth/school-join', { body: joinBody(second) })).status).toBe(404);
  expect((await call('POST', '/api/auth/school-join', { body: { ...joinBody(first), password: 'short' } })).status).toBe(400);
});
