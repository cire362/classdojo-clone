import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

/** Отдельная школа со своим администратором */
async function setupSchool(name: string) {
  const loginName = `admin.${randomUUID().slice(0, 8)}`;
  const school = await prisma.school.create({
    data: {
      name,
      admins: {
        create: {
          name: `Директор: ${name}`,
          account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('admin-test-123') } },
        },
      },
    },
  });
  return { school, cookie: await login(loginName, 'admin-test-123') };
}

it('администратор видит и меняет только свою школу: преподавателей, группы и архивы файлов', async () => {
  const north = await setupSchool('Северная школа');
  const south = await setupSchool('Южная школа');
  const northTeacher = await setupTeacher(['Маша Иванова'], north.school.id);
  const southTeacher = await setupTeacher(['Петя Смирнов'], south.school.id);

  const info = (await call('GET', '/api/admin/school', { cookie: north.cookie })).body;
  expect(info).toMatchObject({ id: north.school.id, name: 'Северная школа' });
  const teachers = (await call('GET', '/api/admin/teachers', { cookie: north.cookie })).body.teachers;
  expect(teachers.map((t: { id: string }) => t.id)).toEqual([northTeacher.teacher.id]);
  const groups = (await call('GET', '/api/admin/groups', { cookie: north.cookie })).body;
  expect(groups.map((g: { id: string }) => g.id)).toEqual([northTeacher.group.id]);

  const foreign = southTeacher.teacher.id;
  expect((await call('POST', `/api/admin/teachers/${foreign}/reset-password`, { cookie: north.cookie })).status).toBe(404);
  expect((await call('PUT', `/api/admin/teachers/${foreign}/premium`, { cookie: north.cookie, body: { until: null } })).status).toBe(404);
  expect((await call('GET', `/api/admin/groups/${southTeacher.group.id}/export`, { cookie: north.cookie })).status).toBe(404);
  expect((await call('GET', `/api/admin/groups/${northTeacher.group.id}/export`, { cookie: north.cookie })).status).toBe(200);
  // Пароль чужого преподавателя не сменился: его вход работает
  expect((await call('GET', '/api/teacher/groups', { cookie: southTeacher.cookie })).status).toBe(200);

  const renamed = await call('PATCH', '/api/admin/school', { cookie: north.cookie, body: { name: '  Гимназия № 1 ' } });
  expect(renamed.body).toMatchObject({ id: north.school.id, name: 'Гимназия № 1', role: 'DIRECTOR' });
  expect((await call('GET', '/api/admin/school', { cookie: south.cookie })).body.name).toBe('Южная школа');
  expect((await call('PATCH', '/api/admin/school', { cookie: north.cookie, body: { name: ' ' } })).status).toBe(400);
});

it('новый преподаватель попадает в школу администратора; соавтор — только из своей школы', async () => {
  const north = await setupSchool('Северная школа');
  const south = await setupSchool('Южная школа');
  const loginName = `t.${randomUUID().slice(0, 8)}`;
  const created = (await call('POST', '/api/admin/teachers', { cookie: north.cookie, body: { name: 'Анна', login: loginName } })).body;
  expect(await prisma.teacher.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ schoolId: north.school.id });
  expect((await call('GET', '/api/admin/teachers', { cookie: south.cookie })).body.teachers).toEqual([]);

  const owner = await setupTeacher(['Маша Иванова'], south.school.id);
  const coTeachers = `/api/teacher/groups/${owner.group.id}/teachers`;
  expect((await call('POST', coTeachers, { cookie: owner.cookie, body: { login: loginName } })).status).toBe(404);
  const body = { name: 'Коллега', login: `${loginName}.s` };
  const colleague = (await call('POST', '/api/admin/teachers', { cookie: south.cookie, body })).body;
  expect((await call('POST', coTeachers, { cookie: owner.cookie, body: { login: colleague.login } })).status).toBe(200);
});

it('первая школа установки по-прежнему видит всех своих преподавателей', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupSchool('Другая школа');
  await setupTeacher(['Петя Смирнов'], other.school.id);
  expect(await prisma.teacher.findUniqueOrThrow({ where: { id: t.teacher.id } })).toMatchObject({ schoolId: 'school-default' });
  const defaultAdmin = await prisma.account.create({
    data: {
      login: `admin.${randomUUID().slice(0, 8)}`,
      role: 'ADMIN',
      passwordHash: await hashPassword('admin-test-123'),
      admin: { create: { name: 'Директор' } },
    },
  });
  const cookie = await login(defaultAdmin.login, 'admin-test-123');
  const teachers = (await call('GET', '/api/admin/teachers', { cookie })).body.teachers as { id: string }[];
  expect(teachers.some((x) => x.id === t.teacher.id)).toBe(true);
  expect(await prisma.teacher.count({ where: { id: { in: teachers.map((x) => x.id) }, schoolId: { not: 'school-default' } } })).toBe(0);
});
