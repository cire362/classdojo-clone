import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { SchoolRole } from '../src/generated/prisma/client';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function university() {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const staff = async (role: SchoolRole) => {
    const loginName = `staff.${randomUUID().slice(0, 8)}`;
    const admin = await prisma.admin.create({
      data: {
        name: `${role} Политех`, role, school: { connect: { id: school.id } },
        account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
      },
    });
    return { id: admin.id, cookie: await login(loginName, 'staff-test-123') };
  };
  return { school, rector: await staff('DIRECTOR'), staff };
}

const ids = (list: { name: string; id: string }[]) => Object.fromEntries(list.map((d) => [d.name, d.id]));

it('ректор создаёт факультеты и кафедры, не глубже одного уровня; удалить можно пустое', async () => {
  const u = await university();
  const add = (body: object) => call('POST', '/api/admin/departments', { cookie: u.rector.cookie, body });
  let list = (await add({ name: 'Факультет ИТ' })).body;
  const it = ids(list)['Факультет ИТ'];
  list = (await add({ name: 'Кафедра ПИ', parentId: it })).body;
  const pi = ids(list)['Кафедра ПИ'];
  expect(list).toEqual([
    { id: pi, name: 'Кафедра ПИ', parentId: it, groups: 0, admins: 0 },
    { id: it, name: 'Факультет ИТ', parentId: null, groups: 0, admins: 0 },
  ]);
  expect((await add({ name: 'Глубже', parentId: pi })).status).toBe(400);
  expect((await call('DELETE', `/api/admin/departments/${it}`, { cookie: u.rector.cookie })).status).toBe(409);
  const renamed = { name: 'Кафедра прикладной информатики', parentId: it };
  const rename = await call('PATCH', `/api/admin/departments/${pi}`, { cookie: u.rector.cookie, body: renamed });
  expect(ids(rename.body)).toHaveProperty('Кафедра прикладной информатики');
  const other = await university();
  expect((await call('DELETE', `/api/admin/departments/${pi}`, { cookie: other.rector.cookie })).status).toBe(404);
  expect((await call('POST', '/api/admin/departments', { cookie: (await u.staff('STAFF')).cookie, body: { name: 'x' } })).status).toBe(403);
  expect((await call('DELETE', `/api/admin/departments/${pi}`, { cookie: u.rector.cookie })).status).toBe(200);
});

it('декан видит и ведёт только группы своего факультета и его кафедр, учреждением не управляет', async () => {
  const u = await university();
  const add = (body: object) => call('POST', '/api/admin/departments', { cookie: u.rector.cookie, body });
  const it = ids((await add({ name: 'Факультет ИТ' })).body)['Факультет ИТ'];
  const pi = ids((await add({ name: 'Кафедра ПИ', parentId: it })).body)['Кафедра ПИ'];
  const econ = ids((await add({ name: 'Экономический' })).body)['Экономический'];
  const a = await setupTeacher(['Маша Иванова'], u.school.id);
  const b = await setupTeacher(['Петя Смирнов'], u.school.id);
  const c = await setupTeacher(['Оля Котова'], u.school.id);
  const patch = (cookie: string, groupId: string, body: object) => call('PATCH', `/api/admin/groups/${groupId}`, { cookie, body });
  const setA = await patch(u.rector.cookie, a.group.id, { departmentId: pi, course: 2, specialty: 'Программная инженерия' });
  expect(setA.body.find((g: { id: string }) => g.id === a.group.id)).toMatchObject({
    department: { id: pi, name: 'Кафедра ПИ' }, course: 2, specialty: 'Программная инженерия',
  });
  await patch(u.rector.cookie, b.group.id, { departmentId: it, course: 1, specialty: '' });
  await patch(u.rector.cookie, c.group.id, { departmentId: econ, course: 3, specialty: '' });

  const dean = await u.staff('DEPUTY');
  await call('PUT', `/api/admin/staff/${dean.id}/department`, { cookie: u.rector.cookie, body: { departmentId: it } });
  const school = (await call('GET', '/api/admin/school', { cookie: dean.cookie })).body;
  expect(school).toMatchObject({ department: { id: it, name: 'Факультет ИТ' }, pendingTeachers: 0, joinCode: null });
  const groups = (await call('GET', '/api/admin/groups', { cookie: dean.cookie })).body;
  expect(groups.map((g: { id: string }) => g.id).sort()).toEqual([a.group.id, b.group.id].sort());
  expect((await call('GET', `/api/admin/groups/${c.group.id}/export`, { cookie: dean.cookie })).status).toBe(404);
  expect((await call('GET', `/api/admin/groups/${a.group.id}/export`, { cookie: dean.cookie })).status).toBe(200);

  expect((await patch(dean.cookie, b.group.id, { departmentId: pi, course: 1, specialty: 'ПИ' })).status).toBe(200);
  expect((await patch(dean.cookie, b.group.id, { departmentId: econ, course: 1, specialty: '' })).status).toBe(403);
  expect((await patch(dean.cookie, c.group.id, { departmentId: it, course: 1, specialty: '' })).status).toBe(404);
  // Управление всем учреждением декану закрыто
  const denied = 'Это может сделать только администрация всего учреждения';
  const teacherBody = { name: 'Новый', login: `t.${randomUUID().slice(0, 8)}` };
  const createTeacher = await call('POST', '/api/admin/teachers', { cookie: dean.cookie, body: teacherBody });
  expect(createTeacher).toMatchObject({ status: 403, body: { error: denied } });
  expect((await call('POST', '/api/admin/departments', { cookie: dean.cookie, body: { name: 'Свой' } })).status).toBe(403);
  expect((await call('POST', '/api/admin/join-code', { cookie: dean.cookie })).status).toBe(403);

  // Пока к подразделению закреплён декан, удалить его нельзя: иначе декан получил бы права на всё учреждение
  expect((await call('DELETE', `/api/admin/departments/${pi}`, { cookie: u.rector.cookie })).status).toBe(200);
  expect((await call('DELETE', `/api/admin/departments/${it}`, { cookie: u.rector.cookie })).status).toBe(409);
  await call('PUT', `/api/admin/staff/${dean.id}/department`, { cookie: u.rector.cookie, body: { departmentId: null } });
  expect((await call('GET', '/api/admin/groups', { cookie: dean.cookie })).body).toHaveLength(3);
});
