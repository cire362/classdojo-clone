import { describe, expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function award(t: Awaited<ReturnType<typeof setupTeacher>>, studentId: string, times: number) {
  for (let i = 0; i < times; i++) {
    await call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: { studentIds: [studentId], reasonId: t.plus2Reason.id } });
  }
}

describe('портфолио', () => {
  it('преподаватель записывает достижение, ученик и родитель его видят', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const other = await setupTeacher(['Чужой Ученик']);
    const masha = t.students[0].id;
    const added = await call('POST', `/api/teacher/students/${masha}/portfolio`, {
      cookie: t.cookie,
      body: { title: 'Призёр олимпиады по математике', description: '2 место в районе', emoji: '🥈' },
    });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject([{ title: 'Призёр олимпиады по математике', emoji: '🥈', author: 'Тестовый учитель' }]);

    expect((await call('GET', '/api/student/profile', { cookie: await t.studentCookie(0) })).body.portfolio).toHaveLength(1);
    const parent = (await call('POST', `/api/teacher/students/${masha}/parents`, { cookie: t.cookie })).body;
    const parentProfile = await call('GET', `/api/parent/children/${masha}/profile`, { cookie: await login(parent.login, parent.password) });
    expect(parentProfile.body.portfolio[0].description).toBe('2 место в районе');

    expect((await call('POST', `/api/teacher/students/${masha}/portfolio`, { cookie: other.cookie, body: { title: 'x' } })).status).toBe(404);
    expect((await call('DELETE', `/api/teacher/portfolio/${added.body[0].id}`, { cookie: other.cookie })).status).toBe(404);
    expect((await call('DELETE', `/api/teacher/portfolio/${added.body[0].id}`, { cookie: t.cookie })).body).toEqual([]);
  });
});

describe('магазин наград', () => {
  it('ученик просит награду на свои баллы, преподаватель подтверждает или отклоняет', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const masha = t.students[0].id;
    const cookie = await t.studentCookie(0);
    const shop = await call('GET', '/api/student/shop', { cookie });
    expect(shop.body.balance).toBe(0);
    const seat = shop.body.rewards.find((r: { cost: number }) => r.cost === 15);

    // Не хватает баллов
    const poor = await call('POST', `/api/student/shop/${seat.id}/request`, { cookie });
    expect(poor.status).toBe(400);
    expect(poor.body.error).toMatch(/Не хватает баллов: нужно 15, у тебя 0/);

    await award(t, masha, 10); // 20 баллов
    const requested = await call('POST', `/api/student/shop/${seat.id}/request`, { cookie });
    expect(requested.status).toBe(201);
    expect(requested.body.balance).toBe(5);
    expect(requested.body.requests[0]).toMatchObject({ status: 'PENDING', cost: 15 });
    // Уровень от трат не падает
    expect((await call('GET', '/api/student/profile', { cookie })).body.level.level).toBe(2);

    const forTeacher = await call('GET', `/api/teacher/groups/${t.group.id}/rewards`, { cookie: t.cookie });
    expect(forTeacher.body.requests[0]).toMatchObject({ status: 'PENDING', student: { name: 'Маша Иванова' } });
    expect((await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).body.pendingRewards).toBe(1);

    // Отказ возвращает баллы
    await call('POST', `/api/teacher/reward-requests/${requested.body.requests[0].id}/reject`, { cookie: t.cookie });
    expect((await call('GET', '/api/student/shop', { cookie })).body.balance).toBe(20);

    // Подтверждение списывает окончательно, повторно решить нельзя
    const again = await call('POST', `/api/student/shop/${seat.id}/request`, { cookie });
    const id = again.body.requests[0].id;
    expect((await call('POST', `/api/teacher/reward-requests/${id}/approve`, { cookie: t.cookie })).status).toBe(200);
    expect((await call('POST', `/api/teacher/reward-requests/${id}/reject`, { cookie: t.cookie })).status).toBe(404);
    expect((await call('GET', '/api/student/shop', { cookie })).body.balance).toBe(5);
  });

  it('одновременные запросы не тратят баллы дважды; отмена ученика; чужие запросы закрыты', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const other = await setupTeacher(['Чужой Ученик']);
    await award(t, t.students[0].id, 10); // 20 баллов
    const cookie = await t.studentCookie(0);
    const seat = (await call('GET', '/api/student/shop', { cookie })).body.rewards.find((r: { cost: number }) => r.cost === 15);

    const results = await Promise.all([1, 2, 3].map(() => call('POST', `/api/student/shop/${seat.id}/request`, { cookie })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const shop = (await call('GET', '/api/student/shop', { cookie })).body;
    expect(shop.balance).toBe(5);

    expect((await call('POST', `/api/teacher/reward-requests/${shop.requests[0].id}/approve`, { cookie: other.cookie })).status).toBe(404);
    // Чужая награда ученику недоступна
    const foreign = (await call('GET', `/api/teacher/groups/${other.group.id}/rewards`, { cookie: other.cookie })).body.rewards[0];
    expect((await call('POST', `/api/student/shop/${foreign.id}/request`, { cookie })).status).toBe(404);

    expect((await call('DELETE', `/api/student/shop/requests/${shop.requests[0].id}`, { cookie })).body.balance).toBe(20);
  });

  it('преподаватель меняет список наград', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const created = await call('POST', `/api/teacher/groups/${t.group.id}/rewards`, { cookie: t.cookie, body: { title: 'Стикер', emoji: '⭐', cost: 5 } });
    expect(created.status).toBe(201);
    const sticker = created.body.find((r: { title: string }) => r.title === 'Стикер');
    expect(created.body[0]).toEqual(sticker); // самая дешёвая — первой
    const after = await call('DELETE', `/api/teacher/rewards/${sticker.id}`, { cookie: t.cookie });
    expect(after.body.some((r: { id: string }) => r.id === sticker.id)).toBe(false);
    expect((await call('POST', `/api/teacher/groups/${t.group.id}/rewards`, { cookie: t.cookie, body: { title: 'x', emoji: '⭐', cost: 0 } })).status).toBe(400);
  });
});

describe('команды', () => {
  it('создание, состав, удаление; чужие ученики и команды не принимаются', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов', 'Оля Котова']);
    const other = await setupTeacher(['Чужой Ученик']);
    const g = `/api/teacher/groups/${t.group.id}`;
    await call('POST', `${g}/teams`, { cookie: t.cookie, body: { name: 'Кометы' } });
    const teams = (await call('POST', `${g}/teams`, { cookie: t.cookie, body: { name: 'Ракеты' } })).body;
    expect(teams.map((x: { name: string }) => x.name)).toEqual(['Кометы', 'Ракеты']);
    expect(teams[0].color).not.toBe(teams[1].color);

    const [masha, petya, olya] = t.students.map((s) => s.id);
    expect((await call('PUT', `${g}/teams/assign`, { cookie: t.cookie, body: { assignments: { [masha]: teams[0].id, [petya]: teams[1].id, [olya]: teams[1].id } } })).status).toBe(200);
    let details = (await call('GET', g, { cookie: t.cookie })).body;
    expect(details.teams).toHaveLength(2);
    expect(details.students.find((s: { id: string }) => s.id === petya).teamId).toBe(teams[1].id);

    expect((await call('PUT', `${g}/teams/assign`, { cookie: t.cookie, body: { assignments: { [other.students[0].id]: teams[0].id } } })).status).toBe(404);
    const foreignTeam = (await call('POST', `/api/teacher/groups/${other.group.id}/teams`, { cookie: other.cookie, body: { name: 'Чужие' } })).body[0];
    expect((await call('PUT', `${g}/teams/assign`, { cookie: t.cookie, body: { assignments: { [masha]: foreignTeam.id } } })).status).toBe(404);

    await call('DELETE', `${g}/teams/${teams[1].id}`, { cookie: t.cookie });
    details = (await call('GET', g, { cookie: t.cookie })).body;
    expect(details.students.find((s: { id: string }) => s.id === petya).teamId).toBeNull();
    expect(await prisma.team.count({ where: { groupId: t.group.id } })).toBe(1);
  });
});
