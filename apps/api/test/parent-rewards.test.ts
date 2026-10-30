import { expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { call, login, setupTeacher, type Res } from './helpers.js';

async function fixture() {
  const t = await setupTeacher(['Маша Иванова', 'Ваня Иванов', 'Чужой Ученик']);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const cookie = await login(issued.login, issued.password);
  const reward = await prisma.reward.findFirstOrThrow({ where: { groupId: t.group.id } });
  return { ...t, parentCookie: cookie, parentId: issued.parentId, reward };
}
async function request(t: Awaited<ReturnType<typeof fixture>>, status: 'PENDING' | 'APPROVED' | 'REJECTED', cost: number, title: string) {
  return prisma.rewardRequest.create({ data: { studentId: t.students[0].id, rewardId: t.reward.id, status, cost, title, emoji: '🎁', ...(status === 'PENDING' ? {} : { decidedAt: new Date() }) } });
}
const endpoint = (id: string) => `/api/parent/children/${id}/rewards`;

it('родитель видит баланс, все состояния и снимки наград, не читая уведомления ученика', async () => {
  const t = await fixture();
  await prisma.pointEvent.create({ data: { studentId: t.students[0].id, reasonName: 'Работа', emoji: '⭐', value: 100 } });
  await request(t, 'PENDING', 15, 'Ожидающая награда');
  await request(t, 'APPROVED', 20, 'Выданная награда');
  await request(t, 'REJECTED', 50, 'Отклонённая награда');
  await prisma.reward.update({ where: { id: t.reward.id }, data: { title: 'Новое название', cost: 999, archived: true } });
  const readAt = (await prisma.student.findUniqueOrThrow({ where: { id: t.students[0].id } })).rewardsReadAt;
  const studentCookie = await t.studentCookie(0);
  const before = (await call('GET', '/api/notifications', { cookie: studentCookie })).body;
  const res = await call('GET', endpoint(t.students[0].id), { cookie: t.parentCookie });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ student: { id: t.students[0].id, name: 'Маша Иванова', groupName: t.group.name }, balance: 65, archived: false, nextCursor: null });
  expect(res.body.pending).toMatchObject([{ title: 'Ожидающая награда', cost: 15, status: 'PENDING' }]);
  expect(res.body.history).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Выданная награда', cost: 20, status: 'APPROVED' }), expect.objectContaining({ status: 'REJECTED', cost: 50 })]));
  expect(res.body.rewards.some((r: { id: string }) => r.id === t.reward.id)).toBe(false);
  expect(JSON.stringify(res.body)).not.toMatch(/password|login|decidedById|rewardId|Ваня|Чужой/);
  expect((await prisma.student.findUniqueOrThrow({ where: { id: t.students[0].id } })).rewardsReadAt).toEqual(readAt);
  expect((await call('GET', '/api/notifications', { cookie: studentCookie })).body).toEqual(before);
  expect(before.rewards).toBe(1);
});

it('только свои дети и только просмотр; отзыв привязки сразу закрывает доступ', async () => {
  const t = await fixture();
  await call('POST', `/api/teacher/students/${t.students[1].id}/parents/link`, { cookie: t.cookie, body: { login: (await prisma.parent.findUniqueOrThrow({ where: { id: t.parentId }, include: { account: true } })).account.login } });
  expect((await call('GET', endpoint(t.students[0].id))).status).toBe(401);
  expect((await call('GET', endpoint(t.students[0].id), { cookie: t.cookie })).status).toBe(403);
  expect((await call('GET', endpoint(t.students[0].id), { cookie: await t.studentCookie(0) })).status).toBe(403);
  expect((await call('GET', endpoint(t.students[2].id), { cookie: t.parentCookie })).status).toBe(404);
  const r = await request(t, 'PENDING', 1, 'Только смотреть');
  expect((await call('POST', `/api/student/shop/${t.reward.id}/request`, { cookie: t.parentCookie })).status).toBe(403);
  expect((await call('DELETE', `/api/student/shop/requests/${r.id}`, { cookie: t.parentCookie })).status).toBe(403);
  expect((await call('POST', `/api/teacher/reward-requests/${r.id}/approve`, { cookie: t.parentCookie })).status).toBe(403);
  expect((await call('POST', endpoint(t.students[0].id), { cookie: t.parentCookie })).status).toBe(404);
  expect((await prisma.rewardRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('PENDING');
  await call('DELETE', `/api/teacher/students/${t.students[0].id}/parents/${t.parentId}`, { cookie: t.cookie });
  expect((await call('GET', endpoint(t.students[0].id), { cookie: t.parentCookie })).status).toBe(404);
  expect((await call('GET', endpoint(t.students[1].id), { cookie: t.parentCookie })).status).toBe(200);
});

it('история листается без потерь при равном времени; старые ожидающие остаются вне лимита', async () => {
  const t = await fixture();
  const old = await request(t, 'PENDING', 1, 'Старый запрос');
  await prisma.rewardRequest.update({ where: { id: old.id }, data: { createdAt: new Date('2025-01-01') } });
  await prisma.rewardRequest.createMany({ data: Array.from({ length: 45 }, (_, i) => ({ studentId: old.studentId, rewardId: old.rewardId, title: `Награда ${i}`, emoji: '🎁', cost: 1, status: 'APPROVED' as const, createdAt: new Date('2026-01-01T10:00:00Z') })) });
  const ids: string[] = [];
  let cursor: string | null = null;
  for (const count of [20, 20, 5]) {
    const res: Res<{ pending: { id: string }[]; history: { id: string }[]; nextCursor: string | null }> = await call('GET', `${endpoint(old.studentId)}${cursor ? `?${new URLSearchParams({ before: cursor })}` : ''}`, { cookie: t.parentCookie });
    expect(res.status).toBe(200);
    expect(res.body.pending).toMatchObject([{ id: old.id }]);
    expect(res.body.history).toHaveLength(count);
    ids.push(...res.body.history.map((r: { id: string }) => r.id));
    cursor = res.body.nextCursor;
  }
  expect(cursor).toBeNull();
  expect(new Set(ids).size).toBe(45);
  for (const invalid of ['', 'bad', '2026-01-01T00:00:00.000Z|', '2026-01-01T00:00:00.000Z|id|extra', 'x'.repeat(129)]) {
    expect((await call('GET', `${endpoint(old.studentId)}?${new URLSearchParams({ before: invalid })}`, { cookie: t.parentCookie })).status).toBe(400);
  }
});

it('перевод и архив сохраняют историю, а отмена ребёнком освобождает баланс', async () => {
  const t = await fixture();
  const pending = await request(t, 'PENDING', 5, 'Запрос прежней группы');
  await request(t, 'APPROVED', 2, 'Выдано раньше');
  const next = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Новая группа' } })).body;
  await call('POST', `/api/teacher/students/${pending.studentId}/move`, { cookie: t.cookie, body: { groupId: next.id } });
  await call('POST', `/api/teacher/groups/${next.id}/archive`, { cookie: t.cookie });
  const archived = (await call('GET', endpoint(pending.studentId), { cookie: t.parentCookie })).body;
  expect(archived).toMatchObject({ archived: true, balance: -7, student: { groupName: 'Новая группа' } });
  expect(archived.pending[0].title).toBe('Запрос прежней группы');
  expect(archived.history[0].title).toBe('Выдано раньше');
  expect(archived.rewards.every((r: { id: string }) => r.id !== t.reward.id)).toBe(true);
  await call('DELETE', `/api/student/shop/requests/${pending.id}`, { cookie: await t.studentCookie(0) });
  const after = (await call('GET', endpoint(pending.studentId), { cookie: t.parentCookie })).body;
  expect(after.pending).toEqual([]);
  expect(after.balance).toBe(-2);
});
