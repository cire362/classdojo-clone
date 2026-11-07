import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

const PDF = Buffer.from('%PDF-1.7 курсовая');

async function university() {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  return setupTeacher(['Маша Иванова', 'Петя Смирнов'], school.id);
}

it('студент вуза пишет преподавателям группы, преподаватель отвечает; ветка без родителя', async () => {
  const t = await university();
  const masha = await t.studentCookie(0);
  const id = t.students[0].id;
  const form = new FormData();
  form.append('text', 'Можно сдать курсовую позже?');
  form.append('file', new File([PDF], 'курсовая.pdf'));
  const sent = await call('POST', '/api/student/messages', { cookie: masha, raw: form });
  expect(sent.status).toBe(201);
  expect(sent.body[0]).toMatchObject({ mine: true, author: 'Студент', fromParent: false, files: [{ name: 'курсовая.pdf' }] });
  const fileId = sent.body[0].files[0].id;

  expect((await call('GET', '/api/notifications', { cookie: t.cookie })).body.messages).toBe(1);
  const [row] = (await call('GET', '/api/teacher/messages', { cookie: t.cookie })).body;
  expect(row).toMatchObject({ studentId: id, parentId: null, parentLogin: null, studentName: 'Маша Иванова', unread: 1 });
  const thread = (await call('GET', `/api/teacher/students/${id}/messages`, { cookie: t.cookie })).body;
  expect(thread).toMatchObject({ studentName: 'Маша Иванова', parentLogin: null, messages: [{ author: 'Студент', mine: false }] });
  expect((await call('GET', '/api/notifications', { cookie: t.cookie })).body.messages).toBe(0);
  expect((await call('GET', `/api/files/${fileId}`, { cookie: t.cookie })).status).toBe(200);

  await call('POST', `/api/teacher/students/${id}/messages`, { cookie: t.cookie, body: { text: 'Да, до пятницы' } });
  const later = new Date(Date.now() + 3600_000).toISOString();
  const reminder = { text: 'Напоминание', sendAt: later };
  const scheduled = await call('POST', `/api/teacher/students/${id}/messages`, { cookie: t.cookie, body: reminder });
  expect(scheduled.body.at(-1)).toMatchObject({ scheduled: true });
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.messages).toBe(1);
  const mine = (await call('GET', '/api/student/messages', { cookie: masha })).body;
  expect(mine.map((m: { text: string; author: string }) => [m.text, m.author])).toEqual([
    ['Можно сдать курсовую позже?', 'Студент'],
    ['Да, до пятницы', 'Тестовый учитель'],
  ]);
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.messages).toBe(0);
  const cancelled = await call('DELETE', `/api/teacher/students/${id}/messages/${scheduled.body.at(-1).id}`, { cookie: t.cookie });
  expect(cancelled.body).toHaveLength(2);
});

it('чужие ветку студента не видят; в школе её нет', async () => {
  const t = await university();
  const masha = await t.studentCookie(0);
  const form = new FormData();
  form.append('text', 'Вопрос');
  form.append('file', new File([PDF], 'вопрос.pdf'));
  const fileId = (await call('POST', '/api/student/messages', { cookie: masha, raw: form })).body[0].files[0].id;
  const petya = await t.studentCookie(1);
  expect((await call('GET', '/api/student/messages', { cookie: petya })).body).toEqual([]);
  expect((await call('GET', `/api/files/${fileId}`, { cookie: petya })).status).toBe(404);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const parent = await login(issued.login, issued.password);
  expect((await call('GET', `/api/files/${fileId}`, { cookie: parent })).status).toBe(404);
  expect((await call('GET', `/api/parent/children/${t.students[0].id}/messages`, { cookie: parent })).body).toEqual([]);
  const other = await university();
  expect((await call('GET', `/api/teacher/students/${t.students[0].id}/messages`, { cookie: other.cookie })).status).toBe(404);

  const school = await setupTeacher(['Оля Котова']);
  expect((await call('GET', '/api/student/messages', { cookie: await school.studentCookie(0) })).status).toBe(403);
  expect((await call('GET', `/api/teacher/students/${school.students[0].id}/messages`, { cookie: school.cookie })).status).toBe(404);
});
