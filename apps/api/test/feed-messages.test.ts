import { describe, expect, it } from 'vitest';
import { call, login, setupTeacher } from './helpers.js';

async function withParent(t: Awaited<ReturnType<typeof setupTeacher>>, i = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[i].id}/parents`, { cookie: t.cookie })).body;
  return { ...issued, cookie: await login(issued.login, issued.password) };
}

describe('лента класса', () => {
  it('запись преподавателя видят ученики группы и родители; счётчик новых записей', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
    const other = await setupTeacher(['Чужой Ученик']);
    const parent = await withParent(t);
    const student = await t.studentCookie(1);

    const post = await call('POST', `/api/teacher/groups/${t.group.id}/feed`, { cookie: t.cookie, body: { text: 'Завтра экскурсия в планетарий' } });
    expect(post.status).toBe(201);
    expect((await call('GET', '/api/notifications', { cookie: student })).body).toEqual({ messages: 0, feed: 1, rewards: 0, works: 0, assignments: 0, school: 0 });
    expect((await call('GET', '/api/notifications', { cookie: parent.cookie })).body).toEqual({ messages: 0, feed: 1, rewards: 0, works: 0, assignments: 0, school: 0 });

    const feed = await call('GET', '/api/student/feed', { cookie: student });
    expect(feed.body).toMatchObject([{ text: 'Завтра экскурсия в планетарий', author: 'Тестовый учитель', canDelete: false }]);
    expect((await call('GET', '/api/notifications', { cookie: student })).body.feed).toBe(0);
    expect((await call('GET', `/api/parent/children/${t.students[0].id}/feed`, { cookie: parent.cookie })).body).toHaveLength(1);

    // Ученик другой группы этой записи не видит, чужой преподаватель не пишет в чужую группу
    expect((await call('GET', '/api/student/feed', { cookie: await other.studentCookie(0) })).body).toEqual([]);
    expect((await call('POST', `/api/teacher/groups/${t.group.id}/feed`, { cookie: other.cookie, body: { text: 'x' } })).status).toBe(404);
    expect((await call('POST', `/api/teacher/groups/${t.group.id}/feed`, { cookie: t.cookie, body: { text: '   ' } })).status).toBe(400);

    expect((await call('DELETE', `/api/teacher/posts/${post.body.id}`, { cookie: other.cookie })).status).toBe(404);
    expect((await call('DELETE', `/api/teacher/posts/${post.body.id}`, { cookie: t.cookie })).status).toBe(200);
    expect((await call('GET', '/api/student/feed', { cookie: student })).body).toEqual([]);
  });
});

describe('сообщения родителей и преподавателей', () => {
  it('родитель пишет, преподаватели группы видят ветку и отвечают; счётчики непрочитанного', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
    const parent = await withParent(t, 0);
    const masha = t.students[0].id;

    const sent = await call('POST', `/api/parent/children/${masha}/messages`, { cookie: parent.cookie, body: { text: 'Маша заболела, завтра не придёт' } });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject([{ mine: true, fromParent: true }]);
    expect((await call('GET', '/api/notifications', { cookie: t.cookie })).body.messages).toBe(1);

    const threads = await call('GET', '/api/teacher/messages', { cookie: t.cookie });
    expect(threads.body).toMatchObject([{ studentId: masha, parentId: parent.parentId, studentName: 'Маша Иванова', unread: 1, lastText: 'Маша заболела, завтра не придёт' }]);

    const thread = await call('GET', `/api/teacher/students/${masha}/parents/${parent.parentId}/messages`, { cookie: t.cookie });
    expect(thread.body.messages).toMatchObject([{ author: 'Родитель', mine: false }]);
    expect((await call('GET', '/api/notifications', { cookie: t.cookie })).body.messages).toBe(0);

    await call('POST', `/api/teacher/students/${masha}/parents/${parent.parentId}/messages`, { cookie: t.cookie, body: { text: 'Выздоравливайте!' } });
    expect((await call('GET', '/api/notifications', { cookie: parent.cookie })).body.messages).toBe(1);
    const children = await call('GET', '/api/parent/children', { cookie: parent.cookie });
    expect(children.body[0].unread).toEqual({ messages: 1, feed: 0 });
    const parentView = await call('GET', `/api/parent/children/${masha}/messages`, { cookie: parent.cookie });
    expect(parentView.body.map((m: { author: string }) => m.author)).toEqual(['Родитель', 'Тестовый учитель']);
    expect((await call('GET', '/api/notifications', { cookie: parent.cookie })).body.messages).toBe(0);
  });

  it('чужие ветки закрыты: другой ребёнок, другой преподаватель, ученик', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
    const other = await setupTeacher(['Чужой Ученик']);
    const parent = await withParent(t, 0);
    const [masha, petya] = t.students.map((s) => s.id);

    expect((await call('POST', `/api/parent/children/${petya}/messages`, { cookie: parent.cookie, body: { text: 'x' } })).status).toBe(404);
    expect((await call('GET', `/api/teacher/students/${masha}/parents/${parent.parentId}/messages`, { cookie: other.cookie })).status).toBe(404);
    // Родитель не привязан к Пете — ветки нет
    expect((await call('GET', `/api/teacher/students/${petya}/parents/${parent.parentId}/messages`, { cookie: t.cookie })).status).toBe(404);
    expect((await call('GET', `/api/parent/children/${masha}/messages`, { cookie: await t.studentCookie(0) })).status).toBe(403);
    expect((await call('GET', '/api/teacher/messages', { cookie: other.cookie })).body).toEqual([]);
  });
});
