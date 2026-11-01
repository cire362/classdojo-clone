import { describe, expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const feed = (t: Teacher) => `/api/teacher/groups/${t.group.id}/feed`;
const post = async (t: Teacher, text = 'Экскурсия', publishAt?: string) =>
  (await call('POST', feed(t), { cookie: t.cookie, body: { text, publishAt } })).body;
const later = (minutes = 60) => new Date(Date.now() + minutes * 60_000).toISOString();

async function withParent(t: Teacher, i = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[i].id}/parents`, { cookie: t.cookie })).body;
  const cookie = await login(issued.login, issued.password);
  return { cookie, base: `/api/parent/children/${t.students[i].id}/feed` };
}

describe('отложенная публикация', () => {
  it('запись не видна и не считается новой, пока не наступит её время', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const student = await t.studentCookie(0);
    const parent = await withParent(t);
    const created = await post(t, 'Позже', later());
    expect(created).toMatchObject({ scheduled: true, canComment: false });
    expect((await call('GET', '/api/student/feed', { cookie: student })).body).toEqual([]);
    expect((await call('GET', parent.base, { cookie: parent.cookie })).body).toEqual([]);
    expect((await call('GET', '/api/notifications', { cookie: student })).body.feed).toBe(0);
    expect((await call('GET', '/api/student/notifications', { cookie: student })).body.items).toEqual([]);
    expect((await call('GET', feed(t), { cookie: t.cookie })).body[0]).toMatchObject({ id: created.id, scheduled: true });

    // Наступило время: запись появляется сама и считается новой
    await prisma.post.update({ where: { id: created.id }, data: { createdAt: new Date() } });
    expect((await call('GET', '/api/notifications', { cookie: student })).body.feed).toBe(1);
    expect((await call('GET', '/api/student/feed', { cookie: student })).body[0]).toMatchObject({ text: 'Позже', scheduled: false });
  });

  it('время только в будущем и не дальше 60 дней', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const send = (publishAt: string) => call('POST', feed(t), { cookie: t.cookie, body: { text: 'x', publishAt } });
    expect((await send(later(-5))).status).toBe(400);
    expect((await send(later(61 * 24 * 60))).status).toBe(400);
    expect((await send('завтра')).status).toBe(400);
    expect((await send(later(59 * 24 * 60))).status).toBe(201);
  });

  it('на отложенную запись нельзя реагировать и комментировать', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const { id } = await post(t, 'Позже', later());
    expect((await call('PUT', `${feed(t)}/${id}/reaction`, { cookie: t.cookie, body: { kind: 'like' } })).status).toBe(404);
    expect((await call('POST', `${feed(t)}/${id}/comments`, { cookie: t.cookie, body: { text: 'x' } })).status).toBe(404);
  });
});

describe('закреплённые записи', () => {
  it('идут первыми, больше трёх закрепить нельзя, открепить можно', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const ids = [];
    for (const text of ['1', '2', '3', '4']) ids.push((await post(t, text)).id);
    const pin = (id: string, pinned = true) => call('PUT', `${feed(t)}/${id}/pin`, { cookie: t.cookie, body: { pinned } });
    expect((await pin(ids[0])).body.pinned).toBe(true);
    const student = await t.studentCookie(0);
    expect((await call('GET', '/api/student/feed', { cookie: student })).body[0].id).toBe(ids[0]);
    await pin(ids[1]);
    await pin(ids[2]);
    expect((await pin(ids[3])).status).toBe(400);
    expect((await pin(ids[0])).status).toBe(200);
    await pin(ids[2], false);
    expect((await pin(ids[3])).status).toBe(200);
  });

  it('архив и чужой преподаватель закреплять не могут', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const other = await setupTeacher(['Петя Смирнов']);
    const { id } = await post(t);
    const body = { pinned: true };
    expect((await call('PUT', `${feed(t)}/${id}/pin`, { cookie: other.cookie, body })).status).toBe(404);
    expect((await call('PUT', `${feed(other)}/${id}/pin`, { cookie: other.cookie, body })).status).toBe(404);
    await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
    expect((await call('PUT', `${feed(t)}/${id}/pin`, { cookie: t.cookie, body })).status).toBe(409);
  });
});

describe('реакции', () => {
  it('одна на человека: повтор заменяет, null снимает; видны только числа', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
    const { id } = await post(t);
    const masha = await t.studentCookie(0);
    const parent = await withParent(t, 1);
    const student = (kind: string | null, cookie = masha) => call('PUT', `/api/student/feed/${id}/reaction`, { cookie, body: { kind } });
    expect((await student('like')).body).toMatchObject({ myReaction: 'like', reactions: { like: 1, heart: 0, star: 0 } });
    expect((await student('heart')).body).toMatchObject({ myReaction: 'heart', reactions: { like: 0, heart: 1, star: 0 } });
    const fromParent = await call('PUT', `${parent.base}/${id}/reaction`, { cookie: parent.cookie, body: { kind: 'heart' } });
    expect(fromParent.body.reactions.heart).toBe(2);
    await call('PUT', `${feed(t)}/${id}/reaction`, { cookie: t.cookie, body: { kind: 'star' } });
    expect((await student(null)).body).toMatchObject({ myReaction: null, reactions: { like: 0, heart: 1, star: 1 } });
    expect((await student('smile')).status).toBe(400);
  });

  it('чужая запись и чужой ребёнок — 404, в архиве реагировать нельзя', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const other = await setupTeacher(['Петя Смирнов']);
    const { id } = await post(t);
    const body = { kind: 'like' };
    expect((await call('PUT', `/api/student/feed/${id}/reaction`, { cookie: await other.studentCookie(0), body })).status).toBe(404);
    const stranger = await withParent(other);
    expect((await call('PUT', `/api/parent/children/${t.students[0].id}/feed/${id}/reaction`, { cookie: stranger.cookie, body })).status).toBe(404);
    await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
    expect((await call('PUT', `/api/student/feed/${id}/reaction`, { cookie: await t.studentCookie(0), body })).status).toBe(409);
  });
});

describe('комментарии', () => {
  it('родитель и преподаватель пишут, ученик не видит и не пишет', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const { id } = await post(t);
    const parent = await withParent(t);
    const res = await call('POST', `${parent.base}/${id}/comments`, { cookie: parent.cookie, body: { text: ' Спасибо! ' } });
    expect(res.body.comments).toMatchObject([{ author: 'Родитель: Маша И.', text: 'Спасибо!', canDelete: true }]);
    await call('POST', `${feed(t)}/${id}/comments`, { cookie: t.cookie, body: { text: 'Пожалуйста' } });
    const list = (await call('GET', parent.base, { cookie: parent.cookie })).body[0];
    expect(list.comments.map((c: { text: string }) => c.text)).toEqual(['Спасибо!', 'Пожалуйста']);
    expect(list.comments[1].canDelete).toBe(false);
    const student = await t.studentCookie(0);
    expect((await call('GET', '/api/student/feed', { cookie: student })).body[0]).toMatchObject({ comments: [], canComment: false });
    expect((await call('POST', `/api/student/feed/${id}/comments`, { cookie: student, body: { text: 'x' } })).status).toBe(404);
  });

  it('родитель удаляет только свой, преподаватель любой', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
    const { id } = await post(t);
    const first = await withParent(t, 0);
    const second = await withParent(t, 1);
    const write = async (p: typeof first, text: string) =>
      (await call('POST', `${p.base}/${id}/comments`, { cookie: p.cookie, body: { text } })).body.comments.at(-1).id;
    const mine = await write(first, 'Первый');
    const theirs = await write(second, 'Второй');
    expect((await call('DELETE', `${first.base}/${id}/comments/${theirs}`, { cookie: first.cookie })).status).toBe(404);
    expect((await call('DELETE', `${first.base}/${id}/comments/${mine}`, { cookie: first.cookie })).body.comments).toHaveLength(1);
    expect((await call('DELETE', `${feed(t)}/${id}/comments/${theirs}`, { cookie: t.cookie })).body.comments).toEqual([]);
  });

  it('преподаватель отключает комментарии: старые видны, новые не принимаются', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const { id } = await post(t);
    const parent = await withParent(t);
    const write = () => call('POST', `${parent.base}/${id}/comments`, { cookie: parent.cookie, body: { text: 'Вопрос' } });
    await write();
    await call('PATCH', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie, body: { feedComments: false } });
    expect((await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).body.group.feedComments).toBe(false);
    expect((await write()).status).toBe(409);
    const shown = (await call('GET', parent.base, { cookie: parent.cookie })).body[0];
    expect(shown).toMatchObject({ canComment: false });
    expect(shown.comments).toHaveLength(1);
    await call('PATCH', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie, body: { feedComments: true } });
    expect((await write()).status).toBe(201);
  });

  it('длинный и пустой комментарий отклоняются, удалённая запись уносит комментарии', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const { id } = await post(t);
    const parent = await withParent(t);
    const url = `${parent.base}/${id}/comments`;
    expect((await call('POST', url, { cookie: parent.cookie, body: { text: 'я'.repeat(501) } })).status).toBe(400);
    expect((await call('POST', url, { cookie: parent.cookie, body: { text: '  ' } })).status).toBe(400);
    await call('POST', url, { cookie: parent.cookie, body: { text: 'Хорошо' } });
    await call('DELETE', `/api/teacher/posts/${id}`, { cookie: t.cookie });
    expect(await prisma.postComment.count({ where: { postId: id } })).toBe(0);
  });
});
