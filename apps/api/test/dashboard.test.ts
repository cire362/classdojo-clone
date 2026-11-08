import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { dateKey } from '../src/platform/dates.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

type Row = { name: string; groups: number; students: number; engagement: number | null; earned: number; lost: number };

async function admin(schoolId: string, departmentId: string | null = null) {
  const loginName = `adm.${randomUUID().slice(0, 8)}`;
  await prisma.admin.create({
    data: {
      name: 'Ректор', role: departmentId ? 'DEPUTY' : 'DIRECTOR', school: { connect: { id: schoolId } },
      ...(departmentId ? { department: { connect: { id: departmentId } } } : {}),
      account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('admin-test-123') } },
    },
  });
  return login(loginName, 'admin-test-123');
}

it('панель руководителя: вовлечённость, посещаемость и баллы по группам, курсам и факультетам', async () => {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const faculty = await prisma.department.create({ data: { schoolId: school.id, name: 'Факультет ИТ' } });
  const a = await setupTeacher(['Маша Иванова', 'Петя Смирнов'], school.id);
  const b = await setupTeacher(['Оля Котова'], school.id);
  await prisma.group.update({ where: { id: a.group.id }, data: { name: 'ИВТ-21', course: 2, departmentId: faculty.id } });
  await prisma.group.update({ where: { id: b.group.id }, data: { name: 'Эк-11', course: 1 } });
  const award = (t: typeof a, reasonId: string, studentIds: string[]) =>
    call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: { reasonId, studentIds } });
  await award(a, a.plus2Reason.id, [a.students[0].id]);
  await award(a, a.minusReason.id, [a.students[1].id]);
  await award(b, b.plusReason.id, [b.students[0].id]);
  const attendance = { date: dateKey(), lesson: 1, presentStudentIds: [a.students[0].id], peopleOnPhoto: null, subtractedTeacher: false };
  await call('POST', `/api/teacher/groups/${a.group.id}/attendance`, { cookie: a.cookie, body: attendance });

  const rector = await admin(school.id);
  const byGroup = await call('GET', '/api/admin/dashboard', { cookie: rector });
  expect(byGroup.status).toBe(200);
  const rows: Row[] = byGroup.body.rows;
  // Посещение за урок — тоже плюс: у Маши 2 + 1
  expect(rows.find((r) => r.name === 'ИВТ-21')).toMatchObject({ students: 2, engagement: 0.5, attendance: 0.5, earned: 3, lost: 1 });
  expect(byGroup.body.total).toMatchObject({ groups: 2, students: 3, earned: 4, lost: 1 });
  expect(byGroup.body.total.engagement).toBeCloseTo(2 / 3);

  const byCourse = (await call('GET', '/api/admin/dashboard?by=course', { cookie: rector })).body.rows;
  expect(byCourse.map((r: Row) => r.name)).toEqual(['Курс 1', 'Курс 2']);
  const byDept = (await call('GET', '/api/admin/dashboard?by=department', { cookie: rector })).body.rows;
  expect(byDept.map((r: Row) => r.name)).toEqual(['Факультет ИТ', 'Без факультета']);

  // Декан видит только свой факультет
  const dean = await admin(school.id, faculty.id);
  const deanRows = (await call('GET', '/api/admin/dashboard', { cookie: dean })).body.rows;
  expect(deanRows.map((r: Row) => r.name)).toEqual(['ИВТ-21']);

  const xlsx = await call('GET', '/api/admin/dashboard.xlsx?by=course', { cookie: rector });
  expect(xlsx.status).toBe(200);
  expect(xlsx.headers.get('content-type')).toContain('spreadsheetml');
  expect(xlsx.headers.get('content-disposition')).toContain(encodeURIComponent('Обзор по курсам'));
  const pdf = await call('GET', '/api/admin/dashboard.pdf?by=department', { cookie: rector });
  expect(pdf.status).toBe(200);
  expect(pdf.headers.get('content-type')).toBe('application/pdf');
  expect(pdf.headers.get('content-disposition')).toContain(encodeURIComponent('Обзор по факультетам'));

  expect((await call('GET', '/api/admin/dashboard?from=2026-02-01&to=2026-01-01', { cookie: rector })).status).toBe(400);
  expect((await call('GET', '/api/admin/dashboard', { cookie: a.cookie })).status).toBe(403);
});
