import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function staff(schoolId: string, role: 'DIRECTOR' | 'STAFF') {
  const loginName = `adm.${randomUUID().slice(0, 8)}`;
  await prisma.admin.create({
    data: {
      name: role, role, school: { connect: { id: schoolId } },
      account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('admin-test-123') } },
    },
  });
  return login(loginName, 'admin-test-123');
}

type Teacher = { id: string; disabled: boolean; ownedGroups: number };

it('отключённый преподаватель не входит и выходит на всех устройствах; включение возвращает вход', async () => {
  const school = await prisma.school.create({ data: { name: 'Колледж', kind: 'COLLEGE' } });
  const t = await setupTeacher(['Маша Иванова'], school.id);
  const account = await prisma.account.findUniqueOrThrow({ where: { id: t.teacher.accountId } });
  const director = await staff(school.id, 'DIRECTOR');
  const clerk = await staff(school.id, 'STAFF');
  const url = `/api/admin/teachers/${t.teacher.id}/disabled`;
  expect((await call('PUT', url, { cookie: clerk, body: { disabled: true } })).status).toBe(403);
  const off = await call('PUT', url, { cookie: director, body: { disabled: true } });
  expect(off.body.teachers.find((x: Teacher) => x.id === t.teacher.id).disabled).toBe(true);
  expect((await call('GET', '/api/teacher/groups', { cookie: t.cookie })).status).toBe(401);
  const denied = await call('POST', '/api/auth/login', { body: { login: account.login, password: 'teacher-pass-123' } });
  expect(denied.status).toBe(403);
  expect(denied.body.error).toContain('Вход отключён');

  await call('PUT', url, { cookie: director, body: { disabled: false } });
  expect((await login(account.login, 'teacher-pass-123')).length).toBeGreaterThan(0);
});

it('группы переходят коллеге вместе с дисциплинами; удалить можно только без своих групп, портфолио остаётся', async () => {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const leaving = await setupTeacher(['Маша Иванова'], school.id);
  const colleague = await setupTeacher(['Петя Смирнов'], school.id);
  const foreign = await setupTeacher(['Оля Котова']);
  const director = await staff(school.id, 'DIRECTOR');
  // Коллега уже соавтор группы уходящего, а уходящий ведёт в ней дисциплину
  await prisma.groupTeacher.create({ data: { groupId: leaving.group.id, teacherId: colleague.teacher.id } });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: 'Физика' } });
  await prisma.groupSubject.create({ data: { groupId: leaving.group.id, subjectId: subject.id, teacherId: leaving.teacher.id } });
  await call('POST', `/api/teacher/students/${leaving.students[0].id}/portfolio`, {
    cookie: leaving.cookie, body: { title: 'Олимпиада', description: '', emoji: '🏆' },
  });

  const del = () => call('DELETE', `/api/admin/teachers/${leaving.teacher.id}`, { cookie: director });
  expect((await del()).status).toBe(409);
  const transfer = (to: string) =>
    call('POST', `/api/admin/teachers/${leaving.teacher.id}/transfer`, { cookie: director, body: { toTeacherId: to } });
  expect((await transfer(foreign.teacher.id)).status).toBe(404);
  expect((await transfer(leaving.teacher.id)).status).toBe(400);
  const moved = await transfer(colleague.teacher.id);
  expect(moved.body.moved).toBe(1);
  const group = await prisma.group.findUniqueOrThrow({ where: { id: leaving.group.id }, include: { coTeachers: true, subjects: true } });
  expect(group.teacherId).toBe(colleague.teacher.id);
  expect(group.coTeachers).toEqual([]);
  expect(group.subjects.map((s) => s.teacherId)).toEqual([colleague.teacher.id]);

  const deleted = await del();
  expect(deleted.status).toBe(200);
  expect(deleted.body.teachers.map((x: Teacher) => x.id)).not.toContain(leaving.teacher.id);
  expect(await prisma.account.count({ where: { id: leaving.teacher.accountId } })).toBe(0);
  expect(await prisma.portfolioItem.count({ where: { studentId: leaving.students[0].id, createdById: null } })).toBe(1);
  expect(await prisma.student.count({ where: { groupId: leaving.group.id } })).toBe(1);
});
