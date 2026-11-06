import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const PDF = Buffer.from('%PDF-1.7 доклад');
const JPEG = await picture(40, 30, 'image/jpeg');

function submit(cookie: string, fields: { title?: string; text?: string; files?: [string, Uint8Array][] }) {
  const data = new FormData();
  if (fields.title !== undefined) data.append('title', fields.title);
  if (fields.text !== undefined) data.append('text', fields.text);
  for (const [name, bytes] of fields.files ?? []) data.append('file', new File([bytes as BlobPart], name));
  return call('POST', '/api/student/works', { cookie, raw: data });
}

async function parentOf(t: Teacher, i = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[i].id}/parents`, { cookie: t.cookie })).body;
  return login(issued.login, issued.password);
}

const queue = (t: Teacher, cookie = t.cookie) => call('GET', `/api/teacher/groups/${t.group.id}/works`, { cookie });
const decide = (t: Teacher, id: string, status: 'APPROVED' | 'RETURNED', comment = '') =>
  call('PUT', `/api/teacher/groups/${t.group.id}/works/${id}`, { cookie: t.cookie, body: { status, comment } });
const open = (cookie: string, id: string) => call('GET', `/api/files/${id}`, { cookie });
const profile = (cookie: string, studentId: string) => call('GET', `/api/parent/children/${studentId}/profile`, { cookie });

it('до одобрения работу видят только ученик и преподаватели группы; после — и родители', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const masha = await t.studentCookie(0);
  const parent = await parentOf(t);
  const res = await submit(masha, { title: 'Доклад о космосе', text: 'Мой доклад', files: [['доклад.pdf', PDF], ['ракета.jpg', JPEG]] });
  expect(res.status).toBe(201);
  const sent = [{ name: 'доклад.pdf' }, { name: 'ракета.jpg' }];
  expect(res.body).toMatchObject([{ title: 'Доклад о космосе', status: 'PENDING', files: sent }]);
  const [{ id, files }] = res.body;

  expect((await queue(t)).body.pending).toMatchObject([{ id, student: { id: t.students[0].id, name: 'Маша Иванова' } }]);
  expect((await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).body.pendingWorks).toBe(1);
  expect((await open(masha, files[0].id)).status).toBe(200);
  expect((await open(t.cookie, files[0].id)).status).toBe(200);
  expect((await open(parent, files[0].id)).status).toBe(404);
  expect((await open(await t.studentCookie(1), files[0].id)).status).toBe(404);
  expect((await profile(parent, t.students[0].id)).body.works).toEqual([]);

  const approved = await decide(t, id, 'APPROVED', 'Отличный доклад!');
  const decision = { id, status: 'APPROVED', comment: 'Отличный доклад!', decidedBy: 'Тестовый учитель' };
  expect(approved.body).toMatchObject({ pending: [], decided: [decision] });
  expect((await open(parent, files[1].id)).status).toBe(200);
  expect((await profile(parent, t.students[0].id)).body.works).toMatchObject([{ id, title: 'Доклад о космосе', unseen: false }]);
  const zip = await call('GET', `/api/parent/children/${t.students[0].id}/export`, { cookie: parent });
  const names = Object.keys(unzipSync(new Uint8Array(zip.body as ArrayBuffer)));
  expect(names.filter((n) => n.startsWith('Работы/')).map((n) => n.replace(/\d{4}-\d{2}-\d{2} /, ''))).toEqual([
    'Работы/Доклад о космосе/доклад.pdf',
    'Работы/Доклад о космосе/ракета.jpg',
  ]);
});

it('возврат с комментарием: новое решение считается для ученика, пока он не откроет список', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const masha = await t.studentCookie(0);
  const [{ id }] = (await submit(masha, { title: 'Рассказ', text: 'Однажды...' })).body;
  await decide(t, id, 'RETURNED', 'Допиши концовку');
  expect((await call('GET', '/api/notifications', { cookie: masha })).body).toEqual({ messages: 0, feed: 0, rewards: 0, works: 1 });
  expect((await call('GET', '/api/student/works', { cookie: masha })).body).toMatchObject([
    { status: 'RETURNED', comment: 'Допиши концовку', unseen: true },
  ]);
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.works).toBe(0);
  expect((await call('GET', '/api/student/works', { cookie: masha })).body[0].unseen).toBe(false);
});

it('ученик убирает свою работу до публикации, опубликованную снимает только преподаватель', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const masha = await t.studentCookie(0);
  const [{ id: draft, files }] = (await submit(masha, { title: 'Черновик', files: [['черновик.jpg', JPEG]] })).body;
  expect((await call('DELETE', `/api/student/works/${draft}`, { cookie: masha })).body).toEqual([]);
  expect(await prisma.storedFile.count({ where: { id: files[0].id } })).toBe(0);

  const [{ id }] = (await submit(masha, { title: 'Рисунок', files: [['рисунок.jpg', JPEG]] })).body;
  await decide(t, id, 'APPROVED');
  expect((await call('DELETE', `/api/student/works/${id}`, { cookie: masha })).status).toBe(404);
  expect((await call('DELETE', `/api/teacher/works/${id}`, { cookie: t.cookie })).body.decided).toEqual([]);
});

it('проверки: название, пустая работа, число файлов, тип файла, очередь, архив и чужие', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  const masha = await t.studentCookie(0);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  expect((await submit(masha, { text: 'Без названия' })).status).toBe(400);
  expect((await submit(masha, { title: 'Пустая' })).status).toBe(400);
  const six = Array.from({ length: 6 }, (_, i): [string, Uint8Array] => [`${i}.pdf`, PDF]);
  expect((await submit(masha, { title: 'Много', files: six })).status).toBe(400);
  expect((await submit(masha, { title: 'Картинка', files: [['a.pdf', PDF], ['x.svg', svg]] })).status).toBe(415);
  expect((await call('POST', '/api/student/works', { cookie: masha, body: { title: 'JSON' } })).status).toBe(400);
  expect(await prisma.studentWork.count({ where: { studentId: t.students[0].id } })).toBe(0);

  for (let i = 0; i < 10; i++) expect((await submit(masha, { title: `Работа ${i}`, text: 'текст' })).status).toBe(201);
  expect((await submit(masha, { title: 'Одиннадцатая', text: 'текст' })).status).toBe(409);
  const [first] = (await queue(t)).body.pending;
  expect((await queue(t, other.cookie)).status).toBe(404);
  const foreign = `/api/teacher/groups/${other.group.id}/works/${first.id}`;
  expect((await call('PUT', foreign, { cookie: other.cookie, body: { status: 'APPROVED' } })).status).toBe(404);
  expect((await call('DELETE', `/api/teacher/works/${first.id}`, { cookie: other.cookie })).status).toBe(404);
  expect((await decide(t, first.id, 'PENDING' as 'APPROVED')).status).toBe(400);

  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  await decide(t, first.id, 'APPROVED');
  expect((await submit(masha, { title: 'В архиве', text: 'текст' })).status).toBe(409);
  expect((await decide(t, first.id, 'RETURNED')).status).toBe(200);
});
