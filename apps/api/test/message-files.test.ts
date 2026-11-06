import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { sizeOf as storedSize } from '../src/platform/storage.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const later = (minutes = 60) => new Date(Date.now() + minutes * 60_000).toISOString();
const JPEG = await picture(60, 40, 'image/jpeg');
const PDF = Buffer.from('%PDF-1.7 справка');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function withParent(t: Teacher, i = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[i].id}/parents`, { cookie: t.cookie })).body;
  const student = t.students[i].id;
  return {
    ...issued,
    cookie: await login(issued.login, issued.password),
    student,
    thread: `/api/teacher/students/${student}/parents/${issued.parentId}/messages`,
    own: `/api/parent/children/${student}/messages`,
  };
}

function send(path: string, cookie: string, fields: { text?: string; sendAt?: string; files?: [string, Uint8Array][] }) {
  const data = new FormData();
  if (fields.text !== undefined) data.append('text', fields.text);
  if (fields.sendAt) data.append('sendAt', fields.sendAt);
  for (const [name, bytes] of fields.files ?? []) data.append('file', new File([bytes as BlobPart], name));
  return call('POST', path, { cookie, raw: data });
}

const open = (cookie: string, id: string) => call('GET', `/api/files/${id}`, { cookie });
const onDisk = async (id: string) => (await storedSize(id)) !== null;

it('справку родителя видят преподаватели группы, но не ученик, второй родитель и чужой преподаватель', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  const mom = await withParent(t);
  const dad = await withParent(t);

  const res = await send(mom.own, mom.cookie, { files: [['справка.pdf', PDF], ['фото.jpg', JPEG]] });
  expect(res.status).toBe(201);
  const sent = [{ name: 'справка.pdf', mime: 'application/pdf' }, { name: 'фото.jpg', mime: 'image/jpeg' }];
  expect(res.body).toMatchObject([{ text: '', files: sent }]);
  const [pdf, jpg] = res.body[0].files.map((f: { id: string }) => f.id);

  const thread = (await call('GET', mom.thread, { cookie: t.cookie })).body;
  expect(thread.messages[0].files.map((f: { id: string }) => f.id)).toEqual([pdf, jpg]);
  expect((await call('GET', '/api/teacher/messages', { cookie: t.cookie })).body[0].lastText).toBe('Вложение');
  expect((await open(t.cookie, pdf)).headers.get('content-disposition')).toContain('attachment');
  expect((await call('GET', `/api/files/${jpg}?size=preview`, { cookie: mom.cookie })).status).toBe(200);

  expect((await open(dad.cookie, pdf)).status).toBe(404);
  expect((await open(await t.studentCookie(0), pdf)).status).toBe(404);
  expect((await open(other.cookie, pdf)).status).toBe(404);

  // Родитель без детей удаляется вместе с перепиской, а с ней уходят и вложения
  await call('DELETE', `/api/teacher/students/${mom.student}/parents/${mom.parentId}`, { cookie: t.cookie });
  expect((await open(mom.cookie, pdf)).status).toBe(401);
  expect(await prisma.storedFile.count({ where: { id: { in: [pdf, jpg] } } })).toBe(0);
});

it('вложения отложенного сообщения родитель откроет только в срок; отмена удаляет их с диска', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const p = await withParent(t);
  const res = await send(p.thread, t.cookie, { text: 'Памятка к экскурсии', sendAt: later(), files: [['памятка.pdf', PDF]] });
  expect(res.body).toMatchObject([{ scheduled: true, files: [{ name: 'памятка.pdf' }] }]);
  const [{ id, files: [file] }] = res.body;
  expect((await open(t.cookie, file.id)).status).toBe(200);
  expect((await open(p.cookie, file.id)).status).toBe(404);

  expect((await call('DELETE', `${p.thread}/${id}`, { cookie: t.cookie })).status).toBe(200);
  expect(await prisma.storedFile.count({ where: { id: file.id } })).toBe(0);
  expect(await onDisk(file.id)).toBe(false);
});

it('вложение рассылки одно на всех: его видят получившие родители, отмена последней копии удаляет его', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const other = await setupTeacher(['Чужой Ученик']);
  const [masha, petya, stranger] = [await withParent(t, 0), await withParent(t, 1), await withParent(other)];
  const path = `/api/teacher/groups/${t.group.id}/messages`;

  expect((await send(path, t.cookie, { text: 'Расписание на неделю', files: [['расписание.pdf', PDF]] })).body).toEqual({ sent: 2 });
  const [mine] = (await call('GET', masha.own, { cookie: masha.cookie })).body;
  const [his] = (await call('GET', petya.own, { cookie: petya.cookie })).body;
  expect(mine.files).toHaveLength(1);
  expect(his.files).toEqual(mine.files);
  expect(await prisma.storedFile.count({ where: { groupId: t.group.id } })).toBe(1);
  expect((await open(petya.cookie, mine.files[0].id)).status).toBe(200);
  expect((await open(stranger.cookie, mine.files[0].id)).status).toBe(404);
  expect((await open(await t.studentCookie(0), mine.files[0].id)).status).toBe(404);

  await send(path, t.cookie, { text: 'Анкета', sendAt: later(), files: [['анкета.pdf', PDF]] });
  const copies = await prisma.message.findMany({ where: { text: 'Анкета' }, include: { student: true } });
  const fileId = (await prisma.storedFile.findFirstOrThrow({ where: { name: 'анкета.pdf' } })).id;
  const thread = (m: (typeof copies)[number]) => `/api/teacher/students/${m.studentId}/parents/${m.parentId}/messages/${m.id}`;
  await call('DELETE', thread(copies[0]), { cookie: t.cookie });
  expect(await onDisk(fileId)).toBe(true);
  await call('DELETE', thread(copies[1]), { cookie: t.cookie });
  expect(await onDisk(fileId)).toBe(false);
});

it('неподходящий файл отменяет всё сообщение; пределы числа файлов и пустое сообщение', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const p = await withParent(t);
  expect((await send(p.own, p.cookie, { text: 'Картинка', files: [['ok.pdf', PDF], ['x.svg', SVG]] })).status).toBe(415);
  const six = Array.from({ length: 6 }, (_, i): [string, Uint8Array] => [`${i}.pdf`, PDF]);
  expect((await send(p.own, p.cookie, { text: 'Много', files: six })).status).toBe(400);
  expect((await send(p.own, p.cookie, { text: '   ' })).status).toBe(400);
  expect((await call('POST', p.own, { cookie: p.cookie, body: { text: '' } })).status).toBe(400);
  expect(await prisma.message.count({ where: { studentId: p.student } })).toBe(0);
  expect(await prisma.storedFile.count({ where: { studentId: p.student } })).toBe(0);
});

it('в архивной группе текст отправить можно, файлы нельзя; удаление ученика удаляет вложения', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const p = await withParent(t);
  const [message] = (await send(p.own, p.cookie, { files: [['справка.pdf', PDF]] })).body;
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await send(p.own, p.cookie, { text: 'Ещё справка', files: [['2.pdf', PDF]] })).status).toBe(409);
  expect((await send(p.own, p.cookie, { text: 'Спасибо за год' })).status).toBe(201);

  await prisma.group.update({ where: { id: t.group.id }, data: { archivedAt: null } });
  expect((await call('DELETE', `/api/teacher/students/${p.student}`, { cookie: t.cookie })).status).toBe(200);
  expect(await onDisk(message.files[0].id)).toBe(false);
});
