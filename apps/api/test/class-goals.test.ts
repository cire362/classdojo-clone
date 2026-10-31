import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const path = (t: Teacher) => `/api/teacher/groups/${t.group.id}`;
const goal = async (t: Teacher) => (await call('GET', `${path(t)}/goal`, { cookie: t.cookie })).body;
const start = (t: Teacher, target = 5) => call('PUT', `${path(t)}/goal`, { cookie: t.cookie, body: { title: 'Киноурок', target } });
const award = (t: Teacher, reasonId = t.plusReason.id) => call('POST', `${path(t)}/points`, { cookie: t.cookie, body: { studentIds: [t.students[0].id], reasonId } });

it('цель начинает с нуля; плюсы увеличивают прогресс, минусы и траты не меняют его; отмена корректирует', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  await award(t, t.plus2Reason.id);
  expect(await goal(t)).toBeNull();
  const created = await start(t, 2);
  expect(created.body).toMatchObject({ title: 'Киноурок', target: 2, earned: 0, reached: false });
  const first = await award(t);
  expect(first.body.classGoal.earned).toBe(1);
  const second = await award(t, t.plus2Reason.id);
  expect(second.body.classGoal).toMatchObject({ earned: 3, reached: true });
  await award(t, t.minusReason.id);
  expect((await goal(t)).earned).toBe(3);
  const cheap = await prisma.reward.create({ data: { groupId: t.group.id, title: 'Стикер', emoji: '⭐', cost: 1 } });
  await call('POST', `/api/student/shop/${cheap.id}/request`, { cookie: await t.studentCookie(0) });
  expect((await goal(t)).earned).toBe(3);
  await call('POST', '/api/teacher/points/undo', { cookie: t.cookie, body: { eventIds: second.body.eventIds } });
  expect(await goal(t)).toMatchObject({ earned: 1, reached: false });
  expect((await call('GET', path(t), { cookie: t.cookie })).body.classGoal.earned).toBe(1);
});

it('редактирование сохраняет вклад; новая цель и удаление не меняют баллы учеников', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const first = (await start(t)).body;
  await award(t, t.plus2Reason.id);
  const edited = await call('PUT', `${path(t)}/goal`, { cookie: t.cookie, body: { title: 'Настольные игры', target: 8 } });
  expect(edited.body).toMatchObject({ id: first.id, title: 'Настольные игры', earned: 2 });
  const restarted = await call('POST', `${path(t)}/goal/restart`, { cookie: t.cookie, body: { title: 'Экскурсия', target: 20 } });
  expect(restarted.body.id).not.toBe(first.id);
  expect(restarted.body.earned).toBe(0);
  const points = await prisma.pointEvent.findMany({ where: { studentId: t.students[0].id } });
  expect(points).toHaveLength(1);
  expect(points[0].classGoalId).toBeNull();
  await award(t);
  expect((await call('DELETE', `${path(t)}/goal`, { cookie: t.cookie })).status).toBe(200);
  expect(await goal(t)).toBeNull();
  expect((await prisma.pointEvent.aggregate({ where: { studentId: t.students[0].id }, _sum: { value: true } }))._sum.value).toBe(3);
});

it('перевод ученика не переносит вклад в цель другой группы', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  await start(t);
  await award(t, t.plus2Reason.id);
  const destination = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Другая группа' } })).body;
  await call('PUT', `/api/teacher/groups/${destination.id}/goal`, { cookie: t.cookie, body: { title: 'Игры', target: 10 } });
  const moved = await call('POST', `/api/teacher/students/${t.students[0].id}/move`, { cookie: t.cookie, body: { groupId: destination.id } });
  expect(moved.status).toBe(200);
  expect((await goal(t)).earned).toBe(2);
  expect((await call('GET', `/api/teacher/groups/${destination.id}/goal`, { cookie: t.cookie })).body.earned).toBe(0);
});

it('повторная отметка посещения не дублирует вклад и не переносит старые уроки в новую цель', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const save = (lesson: number, present = t.students.map((s) => s.id)) => call('POST', `${path(t)}/attendance`, {
    cookie: t.cookie, body: { lesson, presentStudentIds: present, peopleOnPhoto: null, subtractedTeacher: false },
  });
  await save(1); // до цели
  await start(t);
  await save(1);
  expect((await goal(t)).earned).toBe(0);
  await save(2);
  expect((await goal(t)).earned).toBe(2);
  await save(2, [t.students[0].id]);
  expect((await goal(t)).earned).toBe(1);
  await call('POST', `${path(t)}/goal/restart`, { cookie: t.cookie, body: { title: 'Новая цель', target: 5 } });
  await save(2);
  expect((await goal(t)).earned).toBe(0);
  await save(3);
  expect((await goal(t)).earned).toBe(2);
});

it('соавтор управляет целью, чужие роли закрыты, архив доступен только для просмотра', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  const base = `${path(t)}/goal`;
  for (const method of ['GET', 'PUT', 'DELETE']) {
    expect((await call(method, base, { cookie: other.cookie, ...(method === 'PUT' ? { body: { title: 'x', target: 1 } } : {}) })).status).toBe(404);
    expect((await call(method, base, { cookie: await t.studentCookie(0) })).status).toBe(403);
    expect((await call(method, base)).status).toBe(401);
  }
  await prisma.groupTeacher.create({ data: { groupId: t.group.id, teacherId: other.teacher.id } });
  expect((await call('PUT', base, { cookie: other.cookie, body: { title: 'Вместе', target: 10 } })).status).toBe(200);
  await call('POST', `${path(t)}/archive`, { cookie: t.cookie });
  expect((await call('GET', base, { cookie: other.cookie })).body.title).toBe('Вместе');
  for (const [method, url] of [['PUT', base], ['POST', `${base}/restart`], ['DELETE', base]]) {
    expect((await call(method, url, { cookie: t.cookie, body: { title: 'Нельзя', target: 10 } })).status).toBe(409);
  }
});

it('проверяет цель и число баллов; одновременное начало и начисление не дают ошибок ссылок', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  for (const body of [{ title: ' ', target: 1 }, { title: 'x', target: 0 }, { title: 'x', target: 1.5 }, { title: 'x', target: 1_000_001 }]) {
    expect((await call('PUT', `${path(t)}/goal`, { cookie: t.cookie, body })).status).toBe(400);
  }
  await start(t);
  const results = await Promise.all([
    award(t),
    call('POST', `${path(t)}/goal/restart`, { cookie: t.cookie, body: { title: 'Новый старт', target: 5 } }),
    award(t),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 201, 201]);
  const current = await goal(t);
  const sum = await prisma.pointEvent.aggregate({ where: { classGoalId: current.id }, _sum: { value: true } });
  expect(current.earned).toBe(sum._sum.value ?? 0);
});
