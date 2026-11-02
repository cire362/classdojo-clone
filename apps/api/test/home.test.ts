import { expect, it } from 'vitest';
import { call, login, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;

async function parentOf(t: Teacher, index = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[index].id}/parents`, { cookie: t.cookie })).body;
  return login(issued.login, issued.password);
}

/** Запросы родителя к домашним баллам первого ученика */
async function setup(names = ['Маша Иванова']) {
  const t = await setupTeacher(names);
  const cookie = await parentOf(t);
  const path = `/api/parent/children/${t.students[0].id}/home`;
  return {
    t,
    cookie,
    path,
    board: async () => (await call('GET', path, { cookie })).body,
    goal: (body: object) => call('POST', `${path}/goals`, { cookie, body }),
    award: (body: object) => call('POST', `${path}/points`, { cookie, body }),
  };
}

it('родитель ставит цель и начисляет баллы, ребёнок видит то же самое', async () => {
  const { t, board, goal, award } = await setup();
  expect(await board()).toEqual({ total: 0, goals: [], history: [] });

  expect((await goal({ title: ' Убирать комнату ', target: 5 })).status).toBe(201);
  const [{ id }] = (await board()).goals;
  expect((await award({ goalId: id, points: 2 })).status).toBe(201);
  await award({ goalId: id, reason: 'Убрал без напоминания', points: 1 });
  await award({ reason: 'Помог бабушке', points: 3 });

  const home = await board();
  expect(home.total).toBe(6);
  expect(home.goals).toEqual([{ id, title: 'Убирать комнату', target: 5, progress: 3 }]);
  expect(home.history.map((p: { reason: string }) => p.reason)).toEqual(['Помог бабушке', 'Убрал без напоминания', 'Убирать комнату']);
  expect((await call('GET', '/api/student/home', { cookie: await t.studentCookie(0) })).body).toEqual(home);
});

it('домашние баллы не меняют школьные, уровень и магазин', async () => {
  const { t, award } = await setup();
  const student = await t.studentCookie(0);
  const school = async () => {
    const profile = (await call('GET', '/api/student/profile', { cookie: student })).body;
    const { balance } = (await call('GET', '/api/student/shop', { cookie: student })).body;
    return { profile, balance };
  };
  const before = await school();
  expect(before.profile.level.level).toBe(1);
  expect(before.balance).toBe(0);
  await award({ reason: 'Помыл посуду', points: 10 });
  expect(await school()).toEqual(before);
});

it('все родители ребёнка ведут один счёт, а чужой родитель и преподаватель его не видят', async () => {
  const { t, path, award, board } = await setup(['Маша Иванова', 'Петя Сидоров']);
  await award({ reason: 'Первое', points: 1 });
  const second = await parentOf(t);
  await call('POST', `${path}/points`, { cookie: second, body: { reason: 'Второе', points: 1 } });
  expect((await board()).total).toBe(2);

  const stranger = await parentOf(t, 1);
  expect((await call('GET', path, { cookie: stranger })).status).toBe(404);
  expect((await call('POST', `${path}/points`, { cookie: stranger, body: { reason: 'x', points: 1 } })).status).toBe(404);
  expect((await call('GET', path, { cookie: t.cookie })).status).toBe(403);
  expect((await call('GET', '/api/student/home')).status).toBe(401);
});

it('ученик не может начислять себе баллы', async () => {
  const { t, path } = await setup();
  const student = await t.studentCookie(0);
  expect((await call('POST', `${path}/points`, { cookie: student, body: { reason: 'x', points: 10 } })).status).toBe(403);
  expect((await call('POST', '/api/student/home/points', { cookie: student, body: { reason: 'x', points: 10 } })).status).toBe(404);
});

it('цель чужого ребёнка недоступна даже родителю обоих детей', async () => {
  const { t, cookie, path, goal, award, board } = await setup(['Маша Иванова', 'Петя Сидоров']);
  await goal({ title: 'Цель Маши', target: 3 });
  const [{ id }] = (await board()).goals;
  const login2 = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  await call('POST', `/api/teacher/students/${t.students[1].id}/parents/link`, { cookie: t.cookie, body: { login: login2.login } });
  const both = await login(login2.login, login2.password);
  const other = `/api/parent/children/${t.students[1].id}/home`;
  expect((await call('POST', `${other}/points`, { cookie: both, body: { goalId: id, points: 1 } })).status).toBe(404);
  expect((await call('PUT', `${other}/goals/${id}`, { cookie: both, body: { title: 'x', target: 1 } })).status).toBe(404);
  expect((await call('DELETE', `${other}/goals/${id}`, { cookie: both })).status).toBe(404);

  await award({ goalId: id, points: 1 });
  const [point] = (await board()).history;
  expect((await call('DELETE', `${other}/points/${point.id}`, { cookie: both })).status).toBe(404);
  expect((await board()).total).toBe(1);
  expect((await call('DELETE', `${path}/points/${point.id}`, { cookie })).status).toBe(200);
  expect((await board()).total).toBe(0);
});

it('достигнутая цель уходит вниз списка и больше не принимает баллы, отмена начисления её возвращает', async () => {
  const { cookie, path, goal, award, board } = await setup();
  await goal({ title: 'Короткая', target: 2 });
  await goal({ title: 'Длинная', target: 100 });
  const [short] = (await board()).goals;
  await award({ goalId: short.id, points: 5 });
  const done = await board();
  expect(done.goals.map((g: { title: string }) => g.title)).toEqual(['Длинная', 'Короткая']);
  expect(done.goals[1].progress).toBe(5);
  expect((await award({ goalId: short.id, points: 1 })).status).toBe(409);

  await call('DELETE', `${path}/points/${done.history[0].id}`, { cookie });
  expect((await board()).goals[0].title).toBe('Короткая');
  expect((await award({ goalId: short.id, points: 1 })).status).toBe(201);
});

it('одновременные начисления не проходят мимо проверки цели', async () => {
  const { goal, award, board } = await setup();
  await goal({ title: 'Цель', target: 1 });
  const [{ id }] = (await board()).goals;
  const results = await Promise.all(Array.from({ length: 5 }, () => award({ goalId: id, points: 1 })));
  expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
  expect((await board()).total).toBe(1);
});

it('цель меняется; удаление оставляет начисления в истории и сумме', async () => {
  const { cookie, path, goal, award, board } = await setup();
  await goal({ title: 'Читать', target: 10 });
  const [{ id }] = (await board()).goals;
  await award({ goalId: id, points: 4 });
  expect((await call('PUT', `${path}/goals/${id}`, { cookie, body: { title: 'Читать вслух', target: 4 } })).status).toBe(200);
  expect((await board()).goals).toEqual([{ id, title: 'Читать вслух', target: 4, progress: 4 }]);

  expect((await call('DELETE', `${path}/goals/${id}`, { cookie })).status).toBe(200);
  const home = await board();
  expect(home).toMatchObject({ total: 4, goals: [] });
  expect(home.history[0]).toMatchObject({ goalId: null, reason: 'Читать', points: 4 });
  expect((await call('DELETE', `${path}/goals/${id}`, { cookie })).status).toBe(404);
});

it('ограничения и плохие данные', async () => {
  const { goal, award } = await setup();
  expect((await goal({ title: '  ', target: 5 })).status).toBe(400);
  expect((await goal({ title: 'x', target: 0 })).status).toBe(400);
  expect((await goal({ title: 'x', target: 501 })).status).toBe(400);
  expect((await goal({ title: 'x'.repeat(121), target: 5 })).status).toBe(400);
  expect((await award({ points: 1 })).status).toBe(400);
  expect((await award({ reason: '  ', points: 1 })).status).toBe(400);
  expect((await award({ reason: 'x', points: 0 })).status).toBe(400);
  expect((await award({ reason: 'x', points: -1 })).status).toBe(400);
  expect((await award({ reason: 'x', points: 11 })).status).toBe(400);
  expect((await award({ reason: 'x', points: 1.5 })).status).toBe(400);
  expect((await award({ goalId: 'нет-такой', points: 1 })).status).toBe(404);
  for (let i = 0; i < 20; i++) expect((await goal({ title: `Цель ${i}`, target: 1 })).status).toBe(201);
  expect((await goal({ title: 'Лишняя', target: 1 })).status).toBe(409);
});

it('ученик без родителей видит пустой счёт, удаление ученика не ломается', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const student = await t.studentCookie(0);
  expect((await call('GET', '/api/student/home', { cookie: student })).body).toEqual({ total: 0, goals: [], history: [] });
  const parent = await parentOf(t);
  const path = `/api/parent/children/${t.students[0].id}/home`;
  await call('POST', `${path}/goals`, { cookie: parent, body: { title: 'Цель', target: 1 } });
  await call('POST', `${path}/points`, { cookie: parent, body: { reason: 'Дело', points: 1 } });
  expect((await call('DELETE', `/api/teacher/students/${t.students[0].id}`, { cookie: t.cookie })).status).toBe(200);
});
