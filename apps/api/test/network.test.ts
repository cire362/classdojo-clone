import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

it('руководитель сети видит сводку только по учреждениям своей сети и скачивает её в Excel', async () => {
  const school = await prisma.school.create({ data: { name: 'Школа 1', kind: 'SCHOOL' } });
  const college = await prisma.school.create({ data: { name: 'Колледж связи', kind: 'COLLEGE' } });
  const outside = await prisma.school.create({ data: { name: 'Чужая школа' } });
  const a = await setupTeacher(['Маша Иванова', 'Петя Смирнов'], school.id);
  const b = await setupTeacher(['Оля Котова'], college.id);
  await setupTeacher(['Чужой Ученик'], outside.id);
  const award = (t: typeof a, reasonId: string) =>
    call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: { reasonId, studentIds: [t.students[0].id] } });
  await award(a, a.plus2Reason.id);
  await award(b, b.minusReason.id);

  const loginName = `net.${randomUUID().slice(0, 8)}`;
  await prisma.network.create({
    data: {
      name: 'Управление образования',
      schools: { connect: [{ id: school.id }, { id: college.id }] },
      admins: {
        create: {
          name: 'Начальник',
          account: { create: { login: loginName, role: 'NETWORK', passwordHash: await hashPassword('net-test-123') } },
        },
      },
    },
  });
  const head = await login(loginName, 'net-test-123');
  expect((await call('GET', '/api/auth/me', { cookie: head })).body.user).toMatchObject({ role: 'NETWORK', name: 'Начальник' });

  const overview = (await call('GET', '/api/network/overview', { cookie: head })).body;
  expect(overview.name).toBe('Управление образования');
  expect(overview.schools.map((s: { name: string }) => s.name)).toEqual(['Колледж связи', 'Школа 1']);
  expect(overview.schools[1]).toMatchObject({ kind: 'SCHOOL', groups: 1, students: 2, teachers: 1, engagement: 0.5, earned: 2, lost: 0 });
  expect(overview.schools[0]).toMatchObject({ kind: 'COLLEGE', students: 1, engagement: 0, lost: 1 });
  expect(overview.total).toMatchObject({ groups: 2, students: 3, teachers: 2, earned: 2, lost: 1 });

  const xlsx = await call('GET', '/api/network/overview.xlsx', { cookie: head });
  expect(xlsx.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx.body as ArrayBuffer);
  expect(wb.worksheets[0].getRow(4).getCell(2).value).toBe('Колледж или техникум');

  // Кабинеты других ролей руководителю сети закрыты, и наоборот
  expect((await call('GET', '/api/admin/teachers', { cookie: head })).status).toBe(403);
  expect((await call('GET', '/api/teacher/groups', { cookie: head })).status).toBe(403);
  expect((await call('GET', '/api/network/overview', { cookie: a.cookie })).status).toBe(403);
  expect((await call('GET', '/api/notifications', { cookie: head })).status).toBe(200);
});
