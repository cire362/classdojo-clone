import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { dateKey } from '../src/platform/dates.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

const today = dateKey();

it('каталог дисциплин учреждения: одинаковое название не дублируется, чужое учреждение не видит', async () => {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const t = await setupTeacher(['Маша Иванова'], school.id);
  const other = await setupTeacher(['Петя Смирнов']);
  const created = await call('POST', '/api/teacher/subjects', { cookie: t.cookie, body: { name: 'Математика' } });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject([{ name: 'Математика', groups: 0 }]);
  expect((await call('POST', '/api/teacher/subjects', { cookie: t.cookie, body: { name: 'Математика' } })).status).toBe(409);
  const foreign = (await call('GET', '/api/teacher/subjects', { cookie: other.cookie })).body;
  expect(foreign.some((s: { name: string }) => s.name === 'Математика')).toBe(false);
});

it('дисциплина группы: преподаватель становится соавтором, баллы и отметка запоминают дисциплину, сводка по ним', async () => {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const owner = await setupTeacher(['Маша Иванова', 'Петя Смирнов'], school.id);
  const physicist = await setupTeacher(['Чужой Ученик'], school.id);
  const math = (await call('POST', '/api/teacher/subjects', { cookie: owner.cookie, body: { name: 'Математика' } })).body[0].id;
  const physics = (await call('POST', '/api/teacher/subjects', { cookie: owner.cookie, body: { name: 'Физика' } })).body
    .find((s: { name: string }) => s.name === 'Физика').id;
  const base = `/api/teacher/groups/${owner.group.id}/subjects`;
  await call('POST', base, { cookie: owner.cookie, body: { subjectId: math, teacherId: owner.teacher.id } });
  const set = await call('POST', base, { cookie: owner.cookie, body: { subjectId: physics, teacherId: physicist.teacher.id } });
  expect(set.body.map((s: { subject: { name: string }; teacher: { id: string } }) => [s.subject.name, s.teacher.id])).toEqual([
    ['Математика', owner.teacher.id],
    ['Физика', physicist.teacher.id],
  ]);
  // Преподаватель физики теперь соавтор группы, но назначать дисциплины может только создатель
  expect((await call('GET', `/api/teacher/groups/${owner.group.id}`, { cookie: physicist.cookie })).status).toBe(200);
  const byColleague = { subjectId: math, teacherId: physicist.teacher.id };
  expect((await call('POST', base, { cookie: physicist.cookie, body: byColleague })).status).toBe(403);

  const reasons = (await call('GET', `/api/teacher/groups/${owner.group.id}/reasons`, { cookie: owner.cookie })).body;
  const plus = reasons.find((r: { value: number }) => r.value > 0).id;
  const minus = reasons.find((r: { value: number }) => r.value < 0).id;
  const award = (cookie: string, reasonId: string, subjectId: string | null, studentIds = [owner.students[0].id]) =>
    call('POST', `/api/teacher/groups/${owner.group.id}/points`, { cookie, body: { reasonId, studentIds, subjectId } });
  expect((await award(physicist.cookie, plus, physics, owner.students.map((s) => s.id))).status).toBe(201);
  await award(physicist.cookie, minus, physics);
  await award(owner.cookie, plus, null);
  const foreign = await prisma.subject.create({ data: { schoolId: school.id, name: 'История' } });
  expect((await award(owner.cookie, plus, foreign.id)).status).toBe(404);

  const attendance = {
    date: today, lesson: 1, presentStudentIds: [owner.students[0].id], peopleOnPhoto: null, subtractedTeacher: false, subjectId: physics,
  };
  const marked = await call('POST', `/api/teacher/groups/${owner.group.id}/attendance`, { cookie: physicist.cookie, body: attendance });
  expect(marked.status).toBe(201);

  const summary = (await call('GET', `${base}/summary?from=${today}&to=${today}`, { cookie: owner.cookie })).body;
  const byName = Object.fromEntries(summary.map((r: { subject: { name: string } | null }) => [r.subject?.name ?? 'без', r]));
  expect(byName['Физика']).toMatchObject({ lessons: 1, attendance: 0.5, lost: 1 });
  // Плюсы физики: 2 ученика по +1 и посещение +1 у присутствующей
  expect(byName['Физика'].earned).toBe(3);
  expect(byName['Математика']).toMatchObject({ lessons: 0, attendance: null, earned: 0, lost: 0 });
  expect(byName['без']).toMatchObject({ earned: 1, lessons: 0 });

  // Дисциплина уходит из группы, баллы остаются без неё
  const link = set.body.find((s: { subject: { name: string } }) => s.subject.name === 'Физика').id;
  expect((await call('DELETE', `${base}/${link}`, { cookie: owner.cookie })).body).toHaveLength(1);
  expect((await award(owner.cookie, plus, physics)).status).toBe(404);
});

it('администрация ведёт каталог дисциплин: заместитель меняет, сотрудник только смотрит', async () => {
  const school = await prisma.school.create({ data: { name: 'Колледж', kind: 'COLLEGE' } });
  const staff = async (role: 'DEPUTY' | 'STAFF') => {
    const loginName = `staff.${randomUUID().slice(0, 8)}`;
    await prisma.admin.create({
      data: {
        name: role, role, school: { connect: { id: school.id } },
        account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
      },
    });
    return login(loginName, 'staff-test-123');
  };
  const deputy = await staff('DEPUTY');
  const clerk = await staff('STAFF');
  const created = await call('POST', '/api/admin/subjects', { cookie: deputy, body: { name: 'Электротехника' } });
  expect(created.status).toBe(201);
  const id = created.body[0].id;
  const renamed = await call('PATCH', `/api/admin/subjects/${id}`, { cookie: deputy, body: { name: 'Электроника' } });
  expect(renamed.body[0].name).toBe('Электроника');
  expect((await call('GET', '/api/admin/subjects', { cookie: clerk })).body).toHaveLength(1);
  expect((await call('POST', '/api/admin/subjects', { cookie: clerk, body: { name: 'x' } })).status).toBe(403);
  expect((await call('DELETE', `/api/admin/subjects/${id}`, { cookie: deputy })).body).toEqual([]);
});
