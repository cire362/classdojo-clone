import { expect, it } from 'vitest';
import { addDays, dateKey, startOfDay } from '../src/platform/dates.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const path = (t: Teacher) => `/api/teacher/groups/${t.group.id}/events`;
const inDays = (n: number) => dateKey(addDays(startOfDay(), n));
const month = (date: string) => date.slice(0, 7);
const add = (t: Teacher, body: object) => call('POST', path(t), { cookie: t.cookie, body });

async function parentOf(t: Teacher) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  return login(issued.login, issued.password);
}

it('событие видят ученики и родители группы; порядок: весь день, затем по времени', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const date = '2030-03-15';
  await add(t, { title: 'Экскурсия', date, time: '14:00' });
  await add(t, { title: 'Контрольная', date, time: '09:00', description: ' Глава 3 ' });
  await add(t, { title: 'День открытых дверей', date });
  await add(t, { title: 'Другой месяц', date: '2030-04-01' });
  const parent = await parentOf(t);
  const student = await t.studentCookie(0);
  const titles = (body: { title: string }[]) => body.map((e) => e.title);
  const expected = ['День открытых дверей', 'Контрольная', 'Экскурсия'];
  const fromStudent = await call('GET', '/api/student/events?month=2030-03', { cookie: student });
  expect(titles(fromStudent.body)).toEqual(expected);
  expect(fromStudent.body[1]).toMatchObject({ date, time: '09:00', description: 'Глава 3' });
  expect(titles((await call('GET', `/api/parent/children/${t.students[0].id}/events?month=2030-03`, { cookie: parent })).body)).toEqual(expected);
  expect(titles((await call('GET', `${path(t)}?month=2030-03`, { cookie: t.cookie })).body)).toEqual(expected);
});

it('граница месяца и декабрь считаются верно', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  await add(t, { title: 'Первое', date: '2030-12-01' });
  await add(t, { title: 'Последнее', date: '2030-12-31' });
  await add(t, { title: 'Январь', date: '2031-01-01' });
  const list = await call('GET', `${path(t)}?month=2030-12`, { cookie: t.cookie });
  expect(list.body.map((e: { title: string }) => e.title)).toEqual(['Первое', 'Последнее']);
});

it('плохие данные отклоняются', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await add(t, { title: '  ', date: '2030-01-01' })).status).toBe(400);
  expect((await add(t, { title: 'x', date: 'завтра' })).status).toBe(400);
  expect((await add(t, { title: 'x', date: '2030-01-01', time: '25:00' })).status).toBe(400);
  expect((await add(t, { title: 'x', date: '2030-01-01', remindDays: 15 })).status).toBe(400);
  expect((await call('GET', `${path(t)}?month=2030-13`, { cookie: t.cookie })).status).toBe(400);
  expect((await call('GET', path(t), { cookie: t.cookie })).status).toBe(400);
});

it('напоминание приходит отложенной записью ленты и не видно до срока', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const student = await t.studentCookie(0);
  const date = inDays(10);
  const { body } = await add(t, { title: 'Контрольная', date, time: '09:30', remindDays: 2 });
  const post = await prisma.post.findFirstOrThrow({ where: { groupId: t.group.id } });
  expect(post.text).toContain('Напоминание: Контрольная');
  expect(post.text).toContain('в 09:30');
  expect(dateKey(post.createdAt)).toBe(inDays(8));
  expect((await prisma.classEvent.findUniqueOrThrow({ where: { id: body.id } })).reminderPostId).toBe(post.id);
  expect((await call('GET', '/api/student/feed', { cookie: student })).body).toEqual([]);
  expect((await call('GET', '/api/notifications', { cookie: student })).body.feed).toBe(0);
  // Настал срок: запись выходит сама, с обычным значком
  await prisma.post.update({ where: { id: post.id }, data: { createdAt: new Date() } });
  expect((await call('GET', '/api/notifications', { cookie: student })).body.feed).toBe(1);
});

it('срок напоминания уже прошёл — записи нет, событие создаётся', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await add(t, { title: 'Завтра', date: inDays(1), remindDays: 7 })).status).toBe(201);
  expect(await prisma.post.count({ where: { groupId: t.group.id } })).toBe(0);
});

it('изменение заменяет будущее напоминание, снятое убирает его', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { body } = await add(t, { title: 'Экскурсия', date: inDays(10), remindDays: 1 });
  const url = `${path(t)}/${body.id}`;
  const moved = await call('PUT', url, { cookie: t.cookie, body: { title: 'Поездка', date: inDays(20), remindDays: 1 } });
  expect(moved.body).toMatchObject({ title: 'Поездка', date: inDays(20) });
  const posts = await prisma.post.findMany({ where: { groupId: t.group.id } });
  expect(posts).toHaveLength(1);
  expect(posts[0].text).toContain('Поездка');
  await call('PUT', url, { cookie: t.cookie, body: { title: 'Поездка', date: inDays(20), remindDays: null } });
  expect(await prisma.post.count({ where: { groupId: t.group.id } })).toBe(0);
});

it('удаление события снимает будущее напоминание, вышедшее остаётся', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const first = await add(t, { title: 'Первое', date: inDays(10), remindDays: 1 });
  await call('DELETE', `${path(t)}/${first.body.id}`, { cookie: t.cookie });
  expect(await prisma.post.count({ where: { groupId: t.group.id } })).toBe(0);
  const second = await add(t, { title: 'Второе', date: inDays(10), remindDays: 1 });
  await prisma.post.updateMany({ where: { groupId: t.group.id }, data: { createdAt: new Date(Date.now() - 1000) } });
  await call('DELETE', `${path(t)}/${second.body.id}`, { cookie: t.cookie });
  expect(await prisma.post.count({ where: { groupId: t.group.id } })).toBe(1);
  expect(await prisma.classEvent.count({ where: { groupId: t.group.id } })).toBe(0);
});

it('удаление записи ленты оставляет событие без напоминания', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { body } = await add(t, { title: 'Экскурсия', date: inDays(10), remindDays: 1 });
  const post = await prisma.post.findFirstOrThrow({ where: { groupId: t.group.id } });
  await call('DELETE', `/api/teacher/posts/${post.id}`, { cookie: t.cookie });
  expect((await prisma.classEvent.findUniqueOrThrow({ where: { id: body.id } })).reminderPostId).toBeNull();
});

it('чужие группы закрыты, в архиве календарь только читается', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Смирнов']);
  const { body } = await add(t, { title: 'Экскурсия', date: '2030-03-15' });
  const strangerParent = await parentOf(other);
  expect((await call('GET', `${path(t)}?month=2030-03`, { cookie: other.cookie })).status).toBe(404);
  expect((await call('DELETE', `${path(other)}/${body.id}`, { cookie: other.cookie })).status).toBe(404);
  expect((await call('GET', `/api/parent/children/${t.students[0].id}/events?month=2030-03`, { cookie: strangerParent })).status).toBe(404);
  expect((await call('GET', '/api/student/events?month=2030-03', { cookie: await other.studentCookie(0) })).body).toEqual([]);
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await add(t, { title: 'x', date: '2030-01-01' })).status).toBe(409);
  expect((await call('DELETE', `${path(t)}/${body.id}`, { cookie: t.cookie })).status).toBe(409);
  expect((await call('GET', `${path(t)}?month=2030-03`, { cookie: t.cookie })).body).toHaveLength(1);
});

it('месяц текущей даты работает для ближайших событий', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const date = inDays(0);
  await add(t, { title: 'Сегодня', date });
  expect((await call('GET', `${path(t)}?month=${month(date)}`, { cookie: t.cookie })).body[0].date).toBe(date);
});
