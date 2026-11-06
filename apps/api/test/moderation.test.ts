import { expect, it } from 'vitest';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const later = (minutes = 60) => new Date(Date.now() + minutes * 60_000).toISOString();

async function withParent(t: Teacher, i = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[i].id}/parents`, { cookie: t.cookie })).body;
  const feed = `/api/parent/children/${t.students[i].id}/feed`;
  return { ...issued, cookie: await login(issued.login, issued.password), feed };
}

const feedOf = (t: Teacher) => `/api/teacher/groups/${t.group.id}/feed`;
const queue = (t: Teacher, cookie = t.cookie) => call('GET', `/api/teacher/groups/${t.group.id}/moderation`, { cookie });
const decide = (t: Teacher, target: 'post' | 'comment', id: string, hidden: boolean) =>
  call('PUT', `/api/teacher/groups/${t.group.id}/moderation/${target}/${id}`, { cookie: t.cookie, body: { hidden } });
const report = (p: { cookie: string; feed: string }, postId: string, body: Record<string, unknown>) =>
  call('POST', `${p.feed}/${postId}/reports`, { cookie: p.cookie, body });

async function post(t: Teacher, text: string) {
  return (await call('POST', feedOf(t), { cookie: t.cookie, body: { text } })).body.id as string;
}

it('жалоба на комментарий: очередь у преподавателя, повтор и свой комментарий отклоняются, скрытие убирает его у родителей', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const [mom, dad] = [await withParent(t, 0), await withParent(t, 1)];
  const postId = await post(t, 'Итоги четверти');
  const commented = await call('POST', `${dad.feed}/${postId}/comments`, { cookie: dad.cookie, body: { text: 'Грубый комментарий' } });
  const commentId = commented.body.comments[0].id;
  expect(commented.body.comments[0]).toMatchObject({ canReport: false, reported: false, hidden: false });

  const res = await report(mom, postId, { reason: 'insult', note: 'Оскорбляет детей', commentId });
  expect(res.status).toBe(201);
  expect(res.body.post.comments[0]).toMatchObject({ reported: true, canReport: false, reports: 0 });
  expect((await report(mom, postId, { reason: 'other', commentId })).status).toBe(409);
  expect((await report(dad, postId, { reason: 'other', commentId })).status).toBe(400);
  expect((await report(mom, postId, { reason: 'спам', commentId })).status).toBe(400);

  const [inFeed] = (await call('GET', feedOf(t), { cookie: t.cookie })).body;
  expect(inFeed.comments[0]).toMatchObject({ reports: 1, hidden: false });
  expect(inFeed.canModerate).toBe(true);
  expect((await queue(t)).body.reports).toEqual([
    expect.objectContaining({ target: 'comment', id: commentId, postId, author: 'Родитель: Петя С.', text: 'Грубый комментарий',
      reasons: { insult: 1 }, notes: ['Оскорбляет детей'], hidden: false }),
  ]);

  const decided = await decide(t, 'comment', commentId, true);
  expect(decided.body.reports).toEqual([]);
  expect(decided.body.log.map((e: { action: string; actor: string }) => [e.action, e.actor])).toEqual([
    ['hide', 'Тестовый учитель'],
    ['report', 'Родитель: Маша И.'],
  ]);
  expect(decided.body.log[0]).toMatchObject({ target: 'comment', excerpt: 'Грубый комментарий' });
  expect((await call('GET', mom.feed, { cookie: mom.cookie })).body[0].comments).toEqual([]);
  expect((await call('GET', dad.feed, { cookie: dad.cookie })).body[0].comments).toEqual([]);
  expect((await call('GET', feedOf(t), { cookie: t.cookie })).body[0].comments[0]).toMatchObject({ hidden: true, reports: 0 });
  // Автор не удалит скрытый комментарий сам: решение за преподавателем
  expect((await call('DELETE', `${dad.feed}/${postId}/comments/${commentId}`, { cookie: dad.cookie })).status).toBe(404);
});

it('три жалобы скрывают запись вместе с фото и счётчиком; преподаватель может оставить её', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов', 'Оля Котова']);
  const parents = [await withParent(t, 0), await withParent(t, 1), await withParent(t, 2)];
  const data = new FormData();
  data.append('text', 'Фото с праздника');
  data.append('photo', new File([(await picture(40, 30, 'image/jpeg')) as BlobPart], 'a.jpg'));
  const created = (await call('POST', feedOf(t), { cookie: t.cookie, raw: data })).body;
  const photo = created.media[0].id;

  for (const p of parents.slice(0, 2)) expect((await report(p, created.id, { reason: 'personal' })).status).toBe(201);
  expect((await call('GET', parents[2].feed, { cookie: parents[2].cookie })).body).toHaveLength(1);
  const third = await report(parents[2], created.id, { reason: 'personal' });
  expect(third.status).toBe(201);
  expect(third.body.post).toBeNull();

  const student = await t.studentCookie(0);
  expect((await call('GET', '/api/student/feed', { cookie: student })).body).toEqual([]);
  expect((await call('GET', '/api/notifications', { cookie: student })).body.feed).toBe(0);
  expect((await call('GET', parents[2].feed, { cookie: parents[2].cookie })).body).toEqual([]);
  expect((await call('GET', `/api/files/${photo}`, { cookie: parents[2].cookie })).status).toBe(404);
  expect((await call('GET', `/api/files/${photo}`, { cookie: t.cookie })).status).toBe(200);
  const [teacherView] = (await call('GET', feedOf(t), { cookie: t.cookie })).body;
  expect(teacherView).toMatchObject({ hidden: true, reports: 3 });
  const { log } = (await queue(t)).body;
  expect(log[0]).toMatchObject({ action: 'auto_hide', actor: 'Автоматически по жалобам', target: 'post' });

  const kept = await decide(t, 'post', created.id, false);
  expect(kept.body.log[0]).toMatchObject({ action: 'keep', actor: 'Тестовый учитель' });
  expect((await call('GET', '/api/student/feed', { cookie: student })).body).toHaveLength(1);
  // Тот, кто жаловался, больше не может пожаловаться: решение уже принято
  expect((await call('GET', parents[0].feed, { cookie: parents[0].cookie })).body[0]).toMatchObject({ reported: true, canReport: false });
});

it('удаления преподавателем попадают в журнал, удаление своего комментария родителем — нет', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const mom = await withParent(t);
  const postId = await post(t, 'Запись, которую удалят');
  const comment = (text: string) => call('POST', `${mom.feed}/${postId}/comments`, { cookie: mom.cookie, body: { text } });
  const mine = (await comment('Передумала')).body.comments[0];
  await call('DELETE', `${mom.feed}/${postId}/comments/${mine.id}`, { cookie: mom.cookie });
  const other = (await comment('Лишнее')).body.comments[0];
  await call('DELETE', `${feedOf(t)}/${postId}/comments/${other.id}`, { cookie: t.cookie });
  await call('DELETE', `/api/teacher/posts/${postId}`, { cookie: t.cookie });
  const { log } = (await queue(t)).body;
  expect(log.map((e: { action: string; target: string; excerpt: string }) => [e.action, e.target, e.excerpt])).toEqual([
    ['delete', 'post', 'Запись, которую удалят'],
    ['delete', 'comment', 'Лишнее'],
  ]);
});

it('чужие не видят очередь и не жалуются; скрытое и отложенное недоступны; в архиве модерация работает', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  const mom = await withParent(t);
  const stranger = await withParent(other);
  const postId = await post(t, 'Объявление');
  const scheduled = (await call('POST', feedOf(t), { cookie: t.cookie, body: { text: 'Позже', publishAt: later() } })).body.id;

  expect((await queue(t, other.cookie)).status).toBe(404);
  expect((await decide(other, 'post', postId, true)).status).toBe(404);
  expect((await report(stranger, postId, { reason: 'other' })).status).toBe(404);
  expect((await report(mom, scheduled, { reason: 'other' })).status).toBe(404);
  const wrongTarget = `/api/teacher/groups/${t.group.id}/moderation/user/${postId}`;
  expect((await call('PUT', wrongTarget, { cookie: t.cookie, body: { hidden: true } })).status).toBe(400);

  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await report(mom, postId, { reason: 'inappropriate' })).status).toBe(201);
  expect((await decide(t, 'post', postId, true)).status).toBe(200);
  expect((await report(mom, postId, { reason: 'other' })).status).toBe(404);
  expect((await call('GET', mom.feed, { cookie: mom.cookie })).body).toEqual([]);
});
