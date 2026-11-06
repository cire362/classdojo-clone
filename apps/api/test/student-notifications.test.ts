import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const counts = async (cookie: string) => (await call('GET', '/api/notifications', { cookie })).body;
const inbox = async (cookie: string, query = '') => call('GET', `/api/student/notifications${query}`, { cookie });
const read = (cookie: string, body: { groupId: string; through: string }) => call('POST', '/api/student/notifications/read', { cookie, body });
const post = (t: Teacher, text = 'Завтра экскурсия') => call('POST', `/api/teacher/groups/${t.group.id}/feed`, { cookie: t.cookie, body: { text } });

async function reward(t: Teacher, approve: boolean | null = true, i = 0) {
  await prisma.pointEvent.create({ data: { studentId: t.students[i].id, reasonName: 'Работа', emoji: '⭐', value: 50 } });
  const s = await t.studentCookie(i);
  const r = await prisma.reward.findFirstOrThrow({ where: { groupId: t.group.id } });
  expect((await call('POST', `/api/student/shop/${r.id}/request`, { cookie: s })).status).toBe(201);
  const request = await prisma.rewardRequest.findFirstOrThrow({ where: { studentId: t.students[i].id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
  if (approve !== null) expect((await call('POST', `/api/teacher/reward-requests/${request.id}/${approve ? 'approve' : 'reject'}`, { cookie: t.cookie })).status).toBe(200);
  return request;
}

it('единая коллекция: своя выданная награда и объявления текущей группы; GET не отмечает прочитанным', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const other = await setupTeacher(['Чужой Ученик']);
  await reward(t, false); // отказ — виден в магазине, но не объявляется выданной наградой
  await reward(t, null, 1);
  await reward(t, true, 1); // чужая награда
  const approved = await reward(t);
  await post(t);
  await post(other, 'Чужое объявление');
  const cookie = await t.studentCookie(0);
  const result = await inbox(cookie);
  expect(result.status).toBe(200);
  expect(result.body.items).toHaveLength(2);
  expect(result.body.items.find((n: { kind: string }) => n.kind === 'reward')).toMatchObject({ id: `reward:${approved.id}`, title: 'Награда выдана', text: approved.title, unread: true, href: '/shop' });
  expect(result.body.items.find((n: { kind: string }) => n.kind === 'feed')).toMatchObject({ text: 'Завтра экскурсия', unread: true, href: '/feed' });
  expect(result.body.unreadCount).toBe(2);
  expect((await inbox(cookie)).body.unreadCount).toBe(2);
  expect(await counts(cookie)).toEqual({ messages: 0, feed: 1, rewards: 1, works: 0 });
  expect((await call('POST', `/api/teacher/reward-requests/${approved.id}/approve`, { cookie: t.cookie })).status).toBe(404);
  expect((await inbox(cookie)).body.items).toHaveLength(2);
});

it('прочтение всей коллекции сохраняется между сессиями; старые снимки не откатывают более новую отметку', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  await reward(t);
  await post(t);
  const old = (await inbox(cookie)).body;
  expect((await read(cookie, old)).status).toBe(200);
  await post(t, 'Вторая запись');
  const current = (await inbox(cookie)).body;
  expect(current.unreadCount).toBe(1);
  await read(cookie, current);
  await read(cookie, old);
  const anotherSession = await t.studentCookie(0);
  expect(await counts(anotherSession)).toEqual({ messages: 0, feed: 0, rewards: 0, works: 0 });
  expect((await inbox(anotherSession)).body.items.every((n: { unread: boolean }) => !n.unread)).toBe(true);
  expect((await prisma.feedRead.findUniqueOrThrow({ where: { accountId_groupId: { accountId: (await prisma.student.findUniqueOrThrow({ where: { id: t.students[0].id } })).accountId, groupId: t.group.id } } })).readAt.toISOString()).toBe(current.through);
});

it('события после снимка не теряются при «прочитать все», ни объявления, ни решения о наградах', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  const cutoff = new Date(Date.now() - 5000);
  await prisma.post.create({ data: { groupId: t.group.id, authorId: t.teacher.id, text: 'До просмотра', createdAt: new Date(+cutoff - 1000) } });
  const snapshot = (await inbox(cookie, `?through=${cutoff.toISOString()}`)).body;
  await post(t, 'После просмотра');
  await reward(t);
  expect((await read(cookie, snapshot)).status).toBe(200);
  expect(await counts(cookie)).toEqual({ messages: 0, feed: 1, rewards: 1, works: 0 });
  expect((await inbox(cookie)).body.items.filter((n: { unread: boolean }) => n.unread)).toHaveLength(2);
});

it('просмотр магазина читает награды; просмотр ленты читает объявления, не затрагивая другой раздел', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  await reward(t);
  await post(t);
  await call('GET', '/api/student/feed', { cookie });
  expect(await counts(cookie)).toEqual({ messages: 0, feed: 0, rewards: 1, works: 0 });
  await post(t, 'Ещё новость');
  await call('GET', '/api/student/shop', { cookie });
  expect(await counts(cookie)).toEqual({ messages: 0, feed: 1, rewards: 0, works: 0 });
});

it('перевод меняет объявления, сохраняет личные награды и не даёт старому снимку прочитать новую группу', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  await reward(t);
  const oldPost = (await post(t)).body;
  const old = (await inbox(cookie)).body;
  const next = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Новая группа' } })).body;
  await call('POST', `/api/teacher/groups/${next.id}/feed`, { cookie: t.cookie, body: { text: 'Новое объявление' } });
  expect((await call('POST', `/api/teacher/students/${t.students[0].id}/move`, { cookie: t.cookie, body: { groupId: next.id } })).status).toBe(200);
  expect((await read(cookie, old)).status).toBe(409);
  const result = (await inbox(cookie)).body;
  expect(result.items.map((n: { kind: string }) => n.kind).sort()).toEqual(['feed', 'reward']);
  expect(result.items.some((n: { id: string }) => n.id === `feed:${oldPost.id}`)).toBe(false);
  expect(result.unreadCount).toBe(2);
});

it('пагинация двух источников не дублирует и не теряет события с одинаковым временем', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const studentId = t.students[0].id;
  const cookie = await t.studentCookie(0);
  const at = new Date(Date.now() - 1000);
  await prisma.student.update({ where: { id: studentId }, data: { rewardsReadAt: new Date(0) } });
  await prisma.post.createMany({ data: Array.from({ length: 35 }, (_, i) => ({ groupId: t.group.id, authorId: t.teacher.id, text: `Запись ${i}`, createdAt: at })) });
  const r = await prisma.reward.findFirstOrThrow({ where: { groupId: t.group.id } });
  await prisma.rewardRequest.createMany({ data: Array.from({ length: 35 }, () => ({ studentId, rewardId: r.id, title: r.title, emoji: r.emoji, cost: 1, status: 'APPROVED' as const, decidedAt: at })) });
  const ids: string[] = [];
  let result = (await inbox(cookie)).body;
  expect(result.unreadCount).toBe(70);
  expect(result.items).toHaveLength(30);
  for (let page = 0; page < 3; page++) {
    ids.push(...result.items.map((n: { id: string }) => n.id));
    if (!result.nextCursor) break;
    result = (await inbox(cookie, `?${new URLSearchParams({ before: result.nextCursor, through: result.through })}`)).body;
  }
  expect(ids).toHaveLength(70);
  expect(new Set(ids).size).toBe(70);
  expect(result.nextCursor).toBeNull();
});

it('удаление объявления убирает уведомление; архив остаётся доступен для чтения', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  await reward(t);
  const p = (await post(t)).body;
  await call('DELETE', `/api/teacher/posts/${p.id}`, { cookie: t.cookie });
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  const result = await inbox(cookie);
  expect(result.body.items).toHaveLength(1);
  expect(result.body.items[0].kind).toBe('reward');
  expect((await read(cookie, result.body)).status).toBe(200);
  expect((await counts(cookie)).rewards).toBe(0);
});

it('закрыто для других ролей; неверные страницы и время в будущем отклоняются', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const parent = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  for (const cookie of [undefined, t.cookie, await login(parent.login, parent.password)]) {
    expect((await call('GET', '/api/student/notifications', { cookie })).status).toBe(cookie ? 403 : 401);
    expect((await call('POST', '/api/student/notifications/read', { cookie, body: { groupId: t.group.id, through: new Date().toISOString() } })).status).toBe(cookie ? 403 : 401);
  }
  const cookie = await t.studentCookie(0);
  expect((await inbox(cookie, '?before=oops')).status).toBe(400);
  expect((await read(cookie, { groupId: t.group.id, through: new Date(Date.now() + 60_000).toISOString() })).status).toBe(400);
  expect((await inbox(cookie, '?through=oops')).status).toBe(400);
});
