import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { env } from '../src/platform/env.js';
import { readBytes } from '../src/platform/storage.js';
import { purgeDeletedFiles } from '../src/modules/files/index.js';
import { hashPassword } from '../src/platform/credentials.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;

const PNG = new Uint8Array(await picture(4, 3, 'image/png'));
const JPEG = new Uint8Array(await picture(4, 3, 'image/jpeg'));
const WEBP = new Uint8Array([...Buffer.from('RIFF'), 9, 0, 0, 0, ...Buffer.from('WEBPVP8 ')]);
const PDF = new Uint8Array(Buffer.from('%PDF-1.7 текст'));

/** PDF не пересобирается, поэтому на нём проверяются точные размеры */
function pdfOf(size: number) {
  const bytes = new Uint8Array(size);
  bytes.set(PDF);
  return bytes;
}

function form(bytes: Uint8Array, name = 'снимок.png', type = 'image/png') {
  const data = new FormData();
  data.append('file', new File([bytes as BlobPart], name, { type }));
  return data;
}

const upload = (cookie: string, path: string, data: FormData) => call('POST', `/api/teacher/${path}/files`, { cookie, raw: data });

const toGroup = (t: Teacher, bytes = PNG, name?: string, type?: string) => upload(t.cookie, `groups/${t.group.id}`, form(bytes, name, type));

const toStudent = (t: Teacher, index = 0) => upload(t.cookie, `students/${t.students[index].id}`, form(PNG));

async function parentOf(t: Teacher, index: number) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[index].id}/parents`, { cookie: t.cookie })).body;
  return login(issued.login, issued.password);
}

const onDisk = async (id: string) => (await readBytes(id)) !== null;

it('преподаватель загружает файл, участник группы получает те же байты', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const up = await toGroup(t);
  expect(up.status).toBe(201);
  expect(up.body).toMatchObject({ name: 'снимок.png', mime: 'image/png' });
  const res = await call('GET', `/api/files/${up.body.id}`, { cookie: await t.studentCookie(0) });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/png');
  expect(res.headers.get('content-length')).toBe(String((res.body as ArrayBuffer).byteLength));
  expect(res.headers.get('content-disposition')).toBe(`inline; filename*=UTF-8''${encodeURIComponent('снимок.png')}`);
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('content-security-policy')).toContain('sandbox');
  expect(res.headers.get('cache-control')).toBe('private, no-cache');
});

it('файл группы видят её преподаватели, ученики и родители, чужим он не существует', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Сидоров']);
  const { id } = (await toGroup(t)).body;
  const get = (cookie?: string) => call('GET', `/api/files/${id}`, { cookie }).then((r) => r.status);
  expect(await get(t.cookie)).toBe(200);
  expect(await get(await parentOf(t, 0))).toBe(200);
  expect(await get(other.cookie)).toBe(404);
  expect(await get(await other.studentCookie(0))).toBe(404);
  expect(await get(await parentOf(other, 0))).toBe(404);
  expect(await get()).toBe(401);
});

it('файл ученика видят он, его родитель и преподаватель, но не одноклассники', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Сидоров']);
  const { id } = (await toStudent(t)).body;
  const get = (cookie: string) => call('GET', `/api/files/${id}`, { cookie }).then((r) => r.status);
  expect(await get(t.cookie)).toBe(200);
  expect(await get(await t.studentCookie(0))).toBe(200);
  expect(await get(await parentOf(t, 0))).toBe(200);
  expect(await get(await t.studentCookie(1))).toBe(404);
  expect(await get(await parentOf(t, 1))).toBe(404);
});

it('администратор школы не читает файлы группы и учеников', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const name = `admin_${t.group.id}`;
  await prisma.account.create({ data: { login: name, passwordHash: await hashPassword('admin12345'), role: 'ADMIN' } });
  const cookie = await login(name, 'admin12345');
  for (const { id } of [(await toGroup(t)).body, (await toStudent(t)).body]) {
    expect((await call('GET', `/api/files/${id}`, { cookie })).status).toBe(404);
  }
});

it('файл ученика идёт за ним в новую группу', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Сидоров']);
  const { id } = (await toStudent(t)).body;
  await prisma.student.update({ where: { id: t.students[0].id }, data: { groupId: other.group.id } });
  expect((await call('GET', `/api/files/${id}`, { cookie: other.cookie })).status).toBe(200);
  expect((await call('GET', `/api/files/${id}`, { cookie: t.cookie })).status).toBe(404);
});

it('повторный показ проверяет права и не передаёт байты', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Сидоров']);
  const { id } = (await toGroup(t)).body;
  const headers = { 'if-none-match': `"${id}"` };
  const same = await call('GET', `/api/files/${id}`, { cookie: t.cookie, headers });
  expect(same.status).toBe(304);
  expect((await call('GET', `/api/files/${id}`, { cookie: other.cookie, headers })).status).toBe(404);
});

it('тип определяется по содержимому, а не по имени и заявленному типу', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
  expect((await toGroup(t, html, 'снимок.png', 'image/png')).status).toBe(415);
  expect((await toGroup(t, svg, 'логотип.svg', 'image/svg+xml')).status).toBe(415);
  expect((await toGroup(t, new Uint8Array(), 'пусто.png')).status).toBe(415);
  expect((await toGroup(t, JPEG, 'на самом деле.png')).body.mime).toBe('image/jpeg');
  expect((await toGroup(t, WEBP, 'x.webp', 'image/webp')).status).toBe(415);
  const pdf = await toGroup(t, PDF, 'работа.exe', 'application/x-msdownload');
  expect(pdf.body.mime).toBe('application/pdf');
  const res = await call('GET', `/api/files/${pdf.body.id}`, { cookie: t.cookie });
  expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
});

it('имя файла очищается от пути и служебных символов', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const name = async (raw: string) => (await toGroup(t, PNG, raw)).body.name;
  expect(await name('../../etc/passwd')).toBe('passwd');
  expect(await name('C:\\Users\\Маша\\фото.png')).toBe('фото.png');
  expect(await name('a\r\nSet-Cookie: x.png')).toBe('aSet-Cookie: x.png');
  expect((await name(`${'д'.repeat(300)}.png`)).endsWith('.png')).toBe(true);
  expect((await name(`${'д'.repeat(300)}.png`)).length).toBe(120);
});

it('лимиты: размер файла и место группы вместе с её учениками', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await toGroup(t, pdfOf(env.maxFileBytes + 1), 'a.pdf')).status).toBe(413);
  expect((await toGroup(t, pdfOf(env.maxFileBytes), 'a.pdf')).status).toBe(201);

  await prisma.storedFile.create({
    data: { studentId: t.students[0].id, name: 'x', mime: 'image/png', size: env.groupFilesQuota - env.maxFileBytes - PDF.length },
  });
  expect((await toGroup(t, PDF, 'a.pdf')).status).toBe(201);
  expect((await toGroup(t, PDF, 'a.pdf')).status).toBe(409);
  expect((await toStudent(t)).status).toBe(409);
});

it('параллельные загрузки не обходят лимит группы', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  await prisma.storedFile.create({ data: { groupId: t.group.id, name: 'x', mime: 'image/png', size: env.groupFilesQuota - PDF.length } });
  const results = await Promise.all(Array.from({ length: 4 }, () => toGroup(t, PDF, 'a.pdf')));
  expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
});

it('загружать могут только преподаватели своей группы, в архив нельзя', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Сидоров']);
  const path = `groups/${t.group.id}`;
  expect((await upload(other.cookie, path, form(PNG))).status).toBe(404);
  expect((await upload(other.cookie, `students/${t.students[0].id}`, form(PNG))).status).toBe(404);
  expect((await upload(await t.studentCookie(0), path, form(PNG))).status).toBe(403);
  expect((await upload(t.cookie, path, new FormData())).status).toBe(400);
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await upload(t.cookie, path, form(PNG))).status).toBe(409);
  expect((await upload(t.cookie, `students/${t.students[0].id}`, form(PNG))).status).toBe(409);
});

it('преподаватель удаляет файл из базы и с диска, чужой не может', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Сидоров']);
  const { id } = (await toGroup(t)).body;
  const student = (await toStudent(t)).body.id;
  expect(await onDisk(id)).toBe(true);
  expect(await onDisk(`${id}-preview`)).toBe(true);
  expect((await call('DELETE', `/api/teacher/files/${id}`, { cookie: other.cookie })).status).toBe(404);
  expect((await call('DELETE', `/api/teacher/files/${student}`, { cookie: other.cookie })).status).toBe(404);
  expect(await onDisk(id)).toBe(true);
  expect((await call('DELETE', `/api/teacher/files/${id}`, { cookie: t.cookie })).status).toBe(200);
  expect(await onDisk(id)).toBe(false);
  expect(await onDisk(`${id}-preview`)).toBe(false);
  expect((await call('GET', `/api/files/${id}`, { cookie: t.cookie })).status).toBe(404);
  expect(await prisma.deletedFile.count({ where: { id } })).toBe(0);
});

it('удаление ученика стирает его файлы с диска, файлы группы остаются', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Сидоров']);
  const own = (await toStudent(t)).body.id;
  const shared = (await toGroup(t)).body.id;
  expect((await call('DELETE', `/api/teacher/students/${t.students[0].id}`, { cookie: t.cookie })).status).toBe(200);
  expect(await onDisk(own)).toBe(false);
  expect(await onDisk(shared)).toBe(true);
});

it('удаление группы стирает файлы группы и её учеников', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const ids = [(await toGroup(t)).body.id, (await toStudent(t)).body.id];
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await call('DELETE', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).status).toBe(200);
  for (const id of ids) expect(await onDisk(id)).toBe(false);
});

it('каскад без явной очистки попадает в очередь и стирается при следующем проходе', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { id } = (await toGroup(t)).body;
  await prisma.teacher.delete({ where: { id: t.teacher.id } });
  expect(await prisma.storedFile.count({ where: { id } })).toBe(0);
  expect(await prisma.deletedFile.count({ where: { id } })).toBe(1);
  expect(await onDisk(id)).toBe(true);
  await purgeDeletedFiles();
  expect(await onDisk(id)).toBe(false);
  expect(await prisma.deletedFile.count({ where: { id } })).toBe(0);
});

it('у файла ровно один хозяин: это проверяет база', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const data = { name: 'x', mime: 'image/png', size: 1 };
  await expect(prisma.storedFile.create({ data })).rejects.toThrow();
  await expect(prisma.storedFile.create({ data: { ...data, groupId: t.group.id, studentId: t.students[0].id } })).rejects.toThrow();
});

it('запись без байтов на диске отвечает 404, а не ошибкой сервера', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const row = await prisma.storedFile.create({ data: { groupId: t.group.id, name: 'x', mime: 'image/png', size: 1 } });
  expect((await call('GET', `/api/files/${row.id}`, { cookie: t.cookie })).status).toBe(404);
});
