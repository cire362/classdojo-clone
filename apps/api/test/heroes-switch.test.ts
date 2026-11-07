import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function director(schoolId: string) {
  const loginName = `staff.${randomUUID().slice(0, 8)}`;
  await prisma.admin.create({
    data: {
      name: 'Ректор', role: 'DIRECTOR', school: { connect: { id: schoolId } },
      account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
    },
  });
  return login(loginName, 'staff-test-123');
}

it('руководитель выключает героев во всём учреждении: группы, вход студента, конструктор и магазин', async () => {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const head = await director(school.id);
  const t = await setupTeacher(['Маша Иванова'], school.id);
  const masha = await t.studentCookie(0);
  expect((await call('GET', '/api/auth/me', { cookie: masha })).body.user.heroes).toBe(true);
  expect((await call('GET', '/api/student/shop', { cookie: masha })).status).toBe(200);

  const updated = await call('PATCH', '/api/admin/school', { cookie: head, body: { heroes: false } });
  expect(updated.body).toMatchObject({ heroes: false });
  expect((await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).body.group.heroes).toBe(false);
  expect((await call('GET', '/api/auth/me', { cookie: masha })).body.user.heroes).toBe(false);
  const off = 'В вашей группе герои и награды выключены';
  expect(await call('GET', '/api/student/shop', { cookie: masha })).toMatchObject({ status: 403, body: { error: off } });
  expect((await call('PUT', '/api/student/hero', { cookie: masha, body: { name: 'Гроза', parts: {} } })).status).toBe(403);
  // Баллы остаются
  const reason = (await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie })).body[0].id;
  const body = { reasonId: reason, studentIds: [t.students[0].id] };
  expect((await call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body })).status).toBe(201);

  // Новая группа наследует настройку учреждения, преподаватель может включить героев у своей группы
  const created = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'ИВТ-22' } })).body;
  expect((await call('GET', `/api/teacher/groups/${created.id}`, { cookie: t.cookie })).body.group.heroes).toBe(false);
  await call('PATCH', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie, body: { heroes: true } });
  expect((await call('GET', '/api/student/shop', { cookie: masha })).status).toBe(200);
  expect((await call('GET', '/api/auth/me', { cookie: masha })).body.user.heroes).toBe(true);
});

it('родитель и преподаватель видят, есть ли в группе герои; у преподавателя и родителя флага во входе нет', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  await prisma.group.update({ where: { id: t.group.id }, data: { heroes: false } });
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const parent = await login(issued.login, issued.password);
  expect((await call('GET', '/api/parent/children', { cookie: parent })).body[0]).toMatchObject({ heroes: false });
  const profile = (await call('GET', `/api/teacher/students/${t.students[0].id}/profile`, { cookie: t.cookie })).body;
  expect(profile.student.group.heroes).toBe(false);
  expect((await call('GET', '/api/auth/me', { cookie: t.cookie })).body.user).not.toHaveProperty('heroes');
  expect((await call('GET', '/api/auth/me', { cookie: parent })).body.user).not.toHaveProperty('heroes');
});
