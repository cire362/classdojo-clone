import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { SchoolRole } from '../src/generated/prisma/client';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function setupSchool(name: string) {
  const school = await prisma.school.create({ data: { name } });
  const staff = async (role: SchoolRole) => {
    const loginName = `staff.${randomUUID().slice(0, 8)}`;
    await prisma.admin.create({
      data: {
        name: `${role} ${name}`, role, school: { connect: { id: school.id } },
        account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
      },
    });
    return login(loginName, 'staff-test-123');
  };
  return { school, director: await staff('DIRECTOR'), staff };
}

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const reasonsOf = async (t: Teacher) => (await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie })).body;
const award = (t: Teacher, reasonId: string, studentIds: string[]) =>
  call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: { reasonId, studentIds } });

it('общая причина школы появляется во всех её группах, меняется и удаляется только администрацией', async () => {
  const s = await setupSchool('Северная школа');
  const other = await setupSchool('Южная школа');
  const a = await setupTeacher(['Маша Иванова'], s.school.id);
  const foreign = await setupTeacher(['Оля Котова'], other.school.id);
  const clerk = await s.staff('STAFF');
  const body = { name: 'Дежурство', emoji: '🧹', value: 2 };
  expect((await call('POST', '/api/admin/school-reasons', { cookie: clerk, body })).status).toBe(403);
  const created = await call('POST', '/api/admin/school-reasons', { cookie: s.director, body });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject([body]);
  const schoolReasonId = created.body[0].id;

  // Группа, созданная позже, тоже получает причину; группа другой школы — нет
  const later = (await call('POST', '/api/teacher/groups', { cookie: a.cookie, body: { name: 'Новый класс' } })).body;
  const laterReasons = (await call('GET', `/api/teacher/groups/${later.id}/reasons`, { cookie: a.cookie })).body;
  expect(laterReasons.filter((r: { school: boolean }) => r.school).map((r: { name: string }) => r.name)).toEqual(['Дежурство']);
  expect((await reasonsOf(foreign)).some((r: { name: string }) => r.name === 'Дежурство')).toBe(false);

  const copy = (await reasonsOf(a)).find((r: { name: string }) => r.name === 'Дежурство');
  expect(copy).toMatchObject({ school: true, value: 2 });
  expect((await award(a, copy.id, [a.students[0].id])).status).toBe(201);
  expect((await call('PATCH', `/api/teacher/reasons/${copy.id}`, { cookie: a.cookie, body: { ...body, value: 5 } })).status).toBe(409);
  expect((await call('DELETE', `/api/teacher/reasons/${copy.id}`, { cookie: a.cookie })).status).toBe(409);

  const renamed = { name: 'Дежурство по классу', emoji: '🧹', value: 3 };
  await call('PATCH', `/api/admin/school-reasons/${schoolReasonId}`, { cookie: s.director, body: renamed });
  expect((await reasonsOf(a)).find((r: { id: string }) => r.id === copy.id)).toMatchObject(renamed);
  expect((await call('PATCH', `/api/admin/school-reasons/${schoolReasonId}`, { cookie: other.director, body: renamed })).status).toBe(404);

  expect((await call('DELETE', `/api/admin/school-reasons/${schoolReasonId}`, { cookie: s.director })).body).toEqual([]);
  expect((await reasonsOf(a)).some((r: { id: string }) => r.id === copy.id)).toBe(false);
  // История сохранила название на момент начисления
  expect(await prisma.pointEvent.findFirst({ where: { reasonId: copy.id } })).toMatchObject({ reasonName: 'Дежурство', value: 2 });
});

it('цель школы копят все классы плюсами после её запуска; минусы и чужая школа не считаются', async () => {
  const s = await setupSchool('Северная школа');
  const other = await setupSchool('Южная школа');
  const a = await setupTeacher(['Маша Иванова', 'Петя Смирнов'], s.school.id);
  const b = await setupTeacher(['Оля Котова'], s.school.id);
  const foreign = await setupTeacher(['Чужой Ученик'], other.school.id);
  const plusOf = async (t: Teacher) => (await reasonsOf(t)).find((r: { value: number }) => r.value === 1).id as string;
  const minusOf = async (t: Teacher) => (await reasonsOf(t)).find((r: { value: number }) => r.value === -1).id as string;
  await award(a, await plusOf(a), [a.students[0].id]);

  const goal = await call('PUT', '/api/admin/school-goal', { cookie: s.director, body: { title: 'Школьный пикник', target: 10 } });
  expect(goal.body).toMatchObject({ title: 'Школьный пикник', target: 10, earned: 0, reached: false });
  await award(a, await plusOf(a), [a.students[0].id, a.students[1].id]);
  await award(b, await plusOf(b), [b.students[0].id]);
  await award(a, await minusOf(a), [a.students[0].id]);
  await award(foreign, await plusOf(foreign), [foreign.students[0].id]);

  expect((await call('GET', '/api/teacher/school-points', { cookie: b.cookie })).body.goal).toMatchObject({ earned: 3 });
  expect((await call('GET', '/api/student/school-goal', { cookie: await b.studentCookie(0) })).body.goal).toMatchObject({ earned: 3 });
  expect((await call('GET', '/api/student/school-goal', { cookie: await foreign.studentCookie(0) })).body.goal).toBeNull();

  const edited = await call('PUT', '/api/admin/school-goal', { cookie: s.director, body: { title: 'Пикник', target: 20 } });
  expect(edited.body).toMatchObject({ title: 'Пикник', earned: 3 });
  const restart = { title: 'Экскурсия', target: 20, restart: true };
  const restarted = await call('PUT', '/api/admin/school-goal', { cookie: s.director, body: restart });
  expect(restarted.body).toMatchObject({ earned: 0 });
  const clerk = await s.staff('STAFF');
  expect((await call('PUT', '/api/admin/school-goal', { cookie: clerk, body: { title: 'x', target: 20 } })).status).toBe(403);
  expect((await call('PUT', '/api/admin/school-goal', { cookie: s.director, body: { title: 'Мало', target: 5 } })).status).toBe(400);
  await call('DELETE', '/api/admin/school-goal', { cookie: s.director });
  expect((await call('GET', '/api/admin/school-points', { cookie: s.director })).body.goal).toBeNull();
});

it('рейтинг классов: плюсы на ученика, общие места, только классы своей школы и без отдельных детей', async () => {
  const s = await setupSchool('Северная школа');
  const other = await setupSchool('Южная школа');
  const big = await setupTeacher(['Ученик 1', 'Ученик 2', 'Ученик 3', 'Ученик 4'], s.school.id);
  const small = await setupTeacher(['Маша Иванова'], s.school.id);
  const tie = await setupTeacher(['Оля Котова'], s.school.id);
  const foreign = await setupTeacher(['Чужой Ученик'], other.school.id);
  const plusOf = async (t: Teacher) => (await reasonsOf(t)).find((r: { value: number }) => r.value === 1).id as string;
  // Большой класс набрал больше всего, но на ученика меньше
  await award(big, await plusOf(big), big.students.map((x) => x.id));
  await award(big, await plusOf(big), [big.students[0].id]);
  for (const t of [small, tie]) {
    await award(t, await plusOf(t), [t.students[0].id]);
    await award(t, await plusOf(t), [t.students[0].id]);
  }
  await award(foreign, await plusOf(foreign), [foreign.students[0].id]);
  // Пустая группа и архивная в рейтинг не попадают
  await prisma.group.create({ data: { name: 'Пустой класс', teacherId: small.teacher.id } });
  const archived = await setupTeacher(['Архив'], s.school.id);
  await prisma.group.update({ where: { id: archived.group.id }, data: { archivedAt: new Date() } });

  const view = (await call('GET', '/api/teacher/school-points?period=month', { cookie: small.cookie })).body;
  expect(view.period).toBe('month');
  type Row = { groupId: string; place: number; perStudent: number; earned: number; mine: boolean };
  const byGroup = new Map(view.rating.map((r: Row) => [r.groupId, [r.place, r.perStudent, r.earned, r.mine]]));
  expect(Object.fromEntries(byGroup)).toEqual({
    [small.group.id]: [1, 2, 2, true],
    [tie.group.id]: [1, 2, 2, false],
    [big.group.id]: [3, 1.3, 5, false],
  });
  expect(view.rating[2].groupId).toBe(big.group.id);
  expect(JSON.stringify(view)).not.toContain('Маша Иванова');
  const admin = (await call('GET', '/api/admin/school-points?period=week', { cookie: s.director })).body;
  expect(admin.rating).toHaveLength(3);
  expect(admin.rating.every((r: { mine: boolean }) => !r.mine)).toBe(true);
  expect((await call('GET', '/api/admin/school-points', { cookie: other.director })).body.rating).toHaveLength(1);
});
