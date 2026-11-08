import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { nextName } from '../src/modules/schoolyear/service.js';
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

it('номер в названии меняется, только если записан отдельным числом', () => {
  expect(nextName('5 «А»', 5)).toBe('6 «А»');
  expect(nextName('2 курс ИВТ', 2)).toBe('3 курс ИВТ');
  expect(nextName('ИВТ-21', 2)).toBe('ИВТ-21');
  expect(nextName('10Б', 10)).toBe('11Б');
});

it('новый учебный год: классы переходят дальше, выпускные уходят в архив, повтор нужно подтвердить', async () => {
  const school = await prisma.school.create({ data: { name: 'Школа 7', kind: 'SCHOOL' } });
  const a = await setupTeacher(['Маша Иванова'], school.id);
  const b = await setupTeacher(['Петя Смирнов'], school.id);
  const c = await setupTeacher(['Оля Котова'], school.id);
  await prisma.group.update({ where: { id: a.group.id }, data: { name: '5 «А»', course: 5 } });
  await prisma.group.update({ where: { id: b.group.id }, data: { name: '11 «Б»', course: 11 } });
  await prisma.group.update({ where: { id: c.group.id }, data: { name: 'Кружок' } });
  const director = await staff(school.id, 'DIRECTOR');
  const clerk = await staff(school.id, 'STAFF');
  expect((await call('GET', '/api/admin/school-year', { cookie: clerk })).status).toBe(403);

  const preview = (await call('GET', '/api/admin/school-year', { cookie: director })).body;
  expect(preview).toMatchObject({ lastStartedAt: null, recent: false, maxCourse: 11, withoutCourse: [{ name: 'Кружок' }] });
  expect(preview.groups).toMatchObject([
    { name: '5 «А»', course: 5, nextName: '6 «А»', graduate: false, students: 1 },
    { name: '11 «Б»', course: 11, graduate: true },
  ]);

  const start = (body: object) => call('POST', '/api/admin/school-year', { cookie: director, body });
  expect((await start({ graduateIds: [c.group.id], rename: true })).status).toBe(404);
  const done = await start({ graduateIds: [b.group.id], rename: true });
  expect(done.body).toEqual({ promoted: 1, graduated: 1, renamed: 1 });
  const groups = await prisma.group.findMany({ where: { id: { in: [a.group.id, b.group.id, c.group.id] } }, orderBy: { name: 'asc' } });
  expect(groups.map((g) => [g.name, g.course, !!g.archivedAt])).toEqual([
    ['11 «Б»', 11, true],
    ['6 «А»', 6, false],
    ['Кружок', null, false],
  ]);
  // Ученики выпускного класса остались, группа только в архиве
  expect(await prisma.student.count({ where: { groupId: b.group.id } })).toBe(1);

  expect((await call('GET', '/api/admin/school-year', { cookie: director })).body.recent).toBe(true);
  expect((await start({ graduateIds: [], rename: false })).status).toBe(409);
  expect((await start({ graduateIds: [], rename: false, force: true })).body).toEqual({ promoted: 1, graduated: 0, renamed: 0 });
});
