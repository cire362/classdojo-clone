import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function pending(t: Awaited<ReturnType<typeof setupTeacher>>, status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') {
  const reward = await prisma.reward.findFirstOrThrow({ where: { groupId: t.group.id } });
  return prisma.rewardRequest.create({ data: { studentId: t.students[0].id, rewardId: reward.id, title: reward.title, emoji: reward.emoji, cost: reward.cost, status } });
}
const summary = (cookie: string) => call('GET', '/api/teacher/reward-requests', { cookie });
const count = async (cookie: string) => (await call('GET', '/api/notifications', { cookie })).body.rewards;

it('считает только ожидающие запросы своих и совместных действующих групп, без двойного счёта', async () => {
  const owner = await setupTeacher(['Маша']);
  const colleague = await setupTeacher(['Петя']);
  const foreign = await setupTeacher(['Чужой']);
  await prisma.groupTeacher.create({ data: { groupId: colleague.group.id, teacherId: owner.teacher.id } });
  await pending(owner); await pending(owner);
  await pending(owner, 'APPROVED'); await pending(owner, 'REJECTED');
  await pending(colleague); await pending(foreign);
  const result = await summary(owner.cookie);
  expect(result.status).toBe(200);
  expect(result.body.total).toBe(3);
  expect(result.body.groups).toEqual(expect.arrayContaining([
    { id: owner.group.id, name: owner.group.name, count: 2 },
    { id: colleague.group.id, name: colleague.group.name, count: 1 },
  ]));
  expect(result.body.groups).toHaveLength(2);
  expect(await count(owner.cookie)).toBe(3);
  await call('POST', `/api/teacher/groups/${colleague.group.id}/archive`, { cookie: colleague.cookie });
  expect((await summary(owner.cookie)).body.total).toBe(2);
  expect(await count(owner.cookie)).toBe(2);
  await call('POST', `/api/teacher/groups/${colleague.group.id}/restore`, { cookie: colleague.cookie });
  expect(await count(owner.cookie)).toBe(3);
  await prisma.groupTeacher.deleteMany({ where: { teacherId: owner.teacher.id, groupId: colleague.group.id } });
  expect((await summary(owner.cookie)).body.total).toBe(2);
});

it('решение, отмена и перевод сразу меняют очередь; просмотр не обнуляет счётчик', async () => {
  const t = await setupTeacher(['Маша']);
  const next = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Новая группа' } })).body;
  const one = await pending(t); const two = await pending(t); const three = await pending(t);
  await summary(t.cookie); await summary(t.cookie);
  expect(await count(t.cookie)).toBe(3);
  expect((await call('POST', `/api/teacher/reward-requests/${one.id}/approve`, { cookie: t.cookie })).status).toBe(200);
  expect(await count(t.cookie)).toBe(2);
  expect((await call('POST', `/api/teacher/reward-requests/${two.id}/reject`, { cookie: t.cookie })).status).toBe(200);
  expect(await count(t.cookie)).toBe(1);
  await call('POST', `/api/teacher/students/${t.students[0].id}/move`, { cookie: t.cookie, body: { groupId: next.id } });
  expect((await summary(t.cookie)).body.groups).toEqual([{ id: next.id, name: 'Новая группа', count: 1 }]);
  expect((await call('DELETE', `/api/student/shop/requests/${three.id}`, { cookie: await t.studentCookie(0) })).status).toBe(200);
  expect((await summary(t.cookie)).body).toEqual({ groups: [], total: 0 });
  expect(await count(t.cookie)).toBe(0);
});

it('общая очередь закрыта другим ролям и не раскрывает учеников или историю', async () => {
  const t = await setupTeacher(['Маша']);
  await pending(t);
  const parent = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  expect((await call('GET', '/api/teacher/reward-requests')).status).toBe(401);
  expect((await summary(await t.studentCookie(0))).status).toBe(403);
  expect((await summary(await login(parent.login, parent.password))).status).toBe(403);
  const json = JSON.stringify((await summary(t.cookie)).body);
  expect(json).not.toContain('Маша');
  expect(json).not.toContain(t.students[0].id);
  expect(json).not.toContain(t.students[0].login);
});

it('старая ожидающая награда не теряется за сотней рассмотренных запросов', async () => {
  const t = await setupTeacher(['Маша']);
  const old = await pending(t);
  await prisma.rewardRequest.update({ where: { id: old.id }, data: { createdAt: new Date('2025-01-01T00:00:00Z') } });
  await prisma.rewardRequest.createMany({ data: Array.from({ length: 105 }, () => ({ studentId: old.studentId, rewardId: old.rewardId, title: old.title, emoji: old.emoji, cost: old.cost, status: 'APPROVED' as const })) });
  const list = await call('GET', `/api/teacher/groups/${t.group.id}/rewards`, { cookie: t.cookie });
  expect(list.body.requests[0]).toMatchObject({ id: old.id, status: 'PENDING' });
  expect(list.body.requests.filter((r: { status: string }) => r.status === 'APPROVED')).toHaveLength(100);
  expect(await count(t.cookie)).toBe(1);
});
