import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { env } from '../src/platform/env.js';
import { sizeOf as storedSize } from '../src/platform/storage.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture, sizeOf } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const feed = (t: Teacher) => `/api/teacher/groups/${t.group.id}/feed`;
const JPEG = await picture(60, 40, 'image/jpeg');
const PDF = Buffer.from('%PDF-1.7 документ');

function post(t: Teacher, fields: { text?: string; publishAt?: string; photos?: Uint8Array[] }) {
  const data = new FormData();
  if (fields.text !== undefined) data.append('text', fields.text);
  if (fields.publishAt) data.append('publishAt', fields.publishAt);
  for (const [i, bytes] of (fields.photos ?? []).entries()) data.append('photo', new File([bytes as BlobPart], `${i}.jpg`));
  return call('POST', feed(t), { cookie: t.cookie, raw: data });
}

async function parentOf(t: Teacher) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  return login(issued.login, issued.password);
}

const photo = (cookie: string, id: string, preview = false) => call('GET', `/api/files/${id}${preview ? '?size=preview' : ''}`, { cookie });
const onDisk = async (id: string) => (await storedSize(id)) !== null;

it('запись с фото видят ученики и родители группы, фото идут по порядку', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const wide = await picture(90, 30, 'image/jpeg');
  const res = await post(t, { text: 'Экскурсия в музей', photos: [JPEG, wide] });
  expect(res.status).toBe(201);
  expect(res.body.media).toHaveLength(2);
  const [first, second] = res.body.media.map((m: { id: string }) => m.id);

  const student = await t.studentCookie(0);
  const seen = (await call('GET', '/api/student/feed', { cookie: student })).body;
  expect(seen[0]).toMatchObject({ text: 'Экскурсия в музей', media: [{ id: first, kind: 'photo' }, { id: second, kind: 'photo' }] });
  expect(await sizeOf((await photo(student, second)).body)).toEqual({ width: 90, height: 30 });
  expect((await photo(student, first, true)).status).toBe(200);
  expect((await photo(await parentOf(t), first)).status).toBe(200);
});

it('запись может состоять только из фото, но не может быть пустой', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await post(t, { photos: [JPEG] })).body).toMatchObject({ text: '', media: [{ id: expect.any(String), kind: 'photo' }] });
  expect((await post(t, { text: '   ' })).status).toBe(400);
  expect((await call('POST', feed(t), { cookie: t.cookie, body: { text: '' } })).status).toBe(400);
  expect((await call('POST', feed(t), { cookie: t.cookie, body: { text: 'Без фото' } })).body.media).toEqual([]);
});

it('неподходящий файл отменяет всю запись', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const res = await post(t, { text: 'С документом', photos: [JPEG, PDF] });
  expect(res.status).toBe(415);
  expect(await prisma.post.count({ where: { groupId: t.group.id } })).toBe(0);
  expect(await prisma.storedFile.count({ where: { groupId: t.group.id } })).toBe(0);
});

it('не больше 10 фото и не больше места группы', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await post(t, { text: 'Много', photos: Array.from({ length: 11 }, () => JPEG) })).status).toBe(400);
  expect((await post(t, { text: 'Десять', photos: Array.from({ length: 10 }, () => JPEG) })).status).toBe(201);
  await prisma.storedFile.create({ data: { groupId: t.group.id, name: 'x', mime: 'image/png', size: env.groupFilesQuota } });
  expect((await post(t, { text: 'Сверх места', photos: [JPEG] })).status).toBe(409);
  expect(await prisma.post.count({ where: { groupId: t.group.id, text: 'Сверх места' } })).toBe(0);
});

it('фото отложенной записи до её выхода видят только преподаватели', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const publishAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const res = await post(t, { text: 'Сюрприз к празднику', publishAt, photos: [JPEG] });
  const [{ id }] = res.body.media;
  const student = await t.studentCookie(0);
  const parent = await parentOf(t);
  expect((await photo(t.cookie, id)).status).toBe(200);
  expect((await photo(student, id)).status).toBe(404);
  expect((await photo(parent, id, true)).status).toBe(404);

  const past = new Date(Date.now() - 1000);
  await prisma.post.update({ where: { id: res.body.id }, data: { createdAt: past } });
  await prisma.storedFile.update({ where: { id }, data: { visibleFrom: past } });
  expect((await photo(student, id)).status).toBe(200);
});

it('удаление записи стирает её фото с диска', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const res = await post(t, { text: 'Удалю', photos: [JPEG, JPEG] });
  const ids = res.body.media.map((m: { id: string }) => m.id);
  for (const id of ids) expect(await onDisk(id)).toBe(true);
  expect((await call('DELETE', `/api/teacher/posts/${res.body.id}`, { cookie: t.cookie })).status).toBe(200);
  for (const id of ids) {
    expect(await onDisk(id)).toBe(false);
    expect(await onDisk(`${id}-preview`)).toBe(false);
    expect((await photo(t.cookie, id)).status).toBe(404);
  }
});

it('чужой преподаватель и архивная группа', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Сидоров']);
  const res = await post(t, { text: 'Наше', photos: [JPEG] });
  expect((await photo(other.cookie, res.body.media[0].id)).status).toBe(404);
  expect((await call('POST', feed(t), { cookie: other.cookie, raw: new FormData() })).status).toBe(404);
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await post(t, { text: 'В архив', photos: [JPEG] })).status).toBe(409);
});

it('отметка «не публиковать фото» хранится у ученика и видна в группе', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Сидоров']);
  const path = `/api/teacher/students/${t.students[0].id}`;
  const group = async () => (await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).body.students;
  expect((await group()).map((s: { noPhotos: boolean }) => s.noPhotos)).toEqual([false, false]);
  expect((await call('PATCH', path, { cookie: t.cookie, body: { noPhotos: true } })).body).toMatchObject({ noPhotos: true, name: 'Маша Иванова' });
  expect((await group()).find((s: { id: string }) => s.id === t.students[0].id).noPhotos).toBe(true);
  expect((await call('PATCH', path, { cookie: t.cookie, body: { name: 'Мария Иванова' } })).body).toMatchObject({ noPhotos: true });
  expect((await call('PATCH', path, { cookie: t.cookie, body: {} })).status).toBe(400);
  const other = await setupTeacher(['Вася']);
  expect((await call('PATCH', path, { cookie: other.cookie, body: { noPhotos: false } })).status).toBe(404);
});
