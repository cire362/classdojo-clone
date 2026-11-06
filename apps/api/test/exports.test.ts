import { randomUUID } from 'node:crypto';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { expireArchivedFiles } from '../src/modules/files/index.js';
import { hashPassword } from '../src/platform/credentials.js';
import { addDays, dateKey } from '../src/platform/dates.js';
import { prisma } from '../src/platform/db.js';
import { sizeOf as storedSize } from '../src/platform/storage.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const PDF = Buffer.from('%PDF-1.7 документ');
const today = dateKey();

async function withParent(t: Teacher, i = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[i].id}/parents`, { cookie: t.cookie })).body;
  return { ...issued, cookie: await login(issued.login, issued.password), child: t.students[i].id };
}

function form(fields: Record<string, string>, files: [string, string, Uint8Array][]) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  for (const [field, name, bytes] of files) data.append(field, new File([bytes as BlobPart], name));
  return data;
}

async function unzip(path: string, cookie: string) {
  const res = await call('GET', path, { cookie });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('application/zip');
  return { res, files: unzipSync(new Uint8Array(res.body as ArrayBuffer)) };
}

/** Группа с записью из двух фото, рассылкой с PDF, файлом группы и справкой от родителя */
async function filledGroup() {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const [mom, dad] = [await withParent(t, 0), await withParent(t, 1)];
  const photos = [await picture(40, 30, 'image/jpeg'), await picture(30, 40, 'image/jpeg')];
  const post = await call('POST', `/api/teacher/groups/${t.group.id}/feed`, {
    cookie: t.cookie,
    raw: form({ text: 'Экскурсия: музей / 5 класс' }, [['photo', 'a.jpg', photos[0]], ['photo', 'b.jpg', photos[1]]]),
  });
  await call('POST', `/api/teacher/groups/${t.group.id}/messages`, {
    cookie: t.cookie,
    raw: form({ text: 'Расписание' }, [['file', 'расписание.pdf', PDF]]),
  });
  for (let i = 0; i < 2; i++) {
    await call('POST', `/api/teacher/groups/${t.group.id}/files`, { cookie: t.cookie, raw: form({}, [['file', 'план.pdf', PDF]]) });
  }
  await call('POST', `/api/parent/children/${mom.child}/messages`, { cookie: mom.cookie, raw: form({}, [['file', 'справка.pdf', PDF]]) });
  await call('POST', `/api/parent/children/${dad.child}/messages`, { cookie: dad.cookie, raw: form({}, [['file', 'папина.pdf', PDF]]) });
  return { t, mom, dad, media: post.body.media as { id: string }[] };
}

it('преподаватель скачивает все файлы группы одним ZIP: лента, рассылки, файлы группы и учеников', async () => {
  const { t, media } = await filledGroup();
  const { res, files } = await unzip(`/api/teacher/groups/${t.group.id}/export`, t.cookie);
  expect(res.headers.get('content-disposition')).toContain(encodeURIComponent('Тестовая группа'));
  expect(Object.keys(files).sort()).toEqual([
    `Лента/${today} Экскурсия музей 5 класс/01.jpg`,
    `Лента/${today} Экскурсия музей 5 класс/02.jpg`,
    `Рассылки/${today} Расписание/расписание.pdf`,
    'Ученики/Маша Иванова/справка.pdf',
    'Ученики/Петя Смирнов/папина.pdf',
    'Файлы группы/план (2).pdf',
    'Файлы группы/план.pdf',
    'Что в архиве.txt',
  ]);
  const stored = new Uint8Array((await call('GET', `/api/files/${media[1].id}`, { cookie: t.cookie })).body as ArrayBuffer);
  expect(files[`Лента/${today} Экскурсия музей 5 класс/02.jpg`]).toEqual(stored);
  expect(new TextDecoder().decode(files['Что в архиве.txt'])).toContain('«Тестовая группа»');
});

it('родитель получает только видимое ему: ленту без скрытого и отложенного и свою переписку', async () => {
  const { t, mom, dad } = await filledGroup();
  const later = new Date(Date.now() + 3_600_000).toISOString();
  await call('POST', `/api/teacher/groups/${t.group.id}/feed`, {
    cookie: t.cookie,
    raw: form({ text: 'Отложенная', publishAt: later }, [['photo', 'c.jpg', await picture(20, 20, 'image/jpeg')]]),
  });
  const { files } = await unzip(`/api/parent/children/${mom.child}/export`, mom.cookie);
  expect(Object.keys(files).sort()).toEqual([
    `Лента класса/${today} Экскурсия музей 5 класс/01.jpg`,
    `Лента класса/${today} Экскурсия музей 5 класс/02.jpg`,
    `Сообщения/${today}/расписание.pdf`,
    `Сообщения/${today}/справка.pdf`,
    'Что в архиве.txt',
  ]);

  const [post] = (await call('GET', `/api/teacher/groups/${t.group.id}/feed`, { cookie: t.cookie })).body.filter(
    (p: { text: string }) => p.text.startsWith('Экскурсия'),
  );
  await call('PUT', `/api/teacher/groups/${t.group.id}/moderation/post/${post.id}`, { cookie: t.cookie, body: { hidden: true } });
  expect(Object.keys((await unzip(`/api/parent/children/${dad.child}/export`, dad.cookie)).files).sort()).toEqual([
    `Сообщения/${today}/папина.pdf`,
    `Сообщения/${today}/расписание.pdf`,
    'Что в архиве.txt',
  ]);
  expect((await call('GET', `/api/parent/children/${dad.child}/export`, { cookie: mom.cookie })).status).toBe(404);
});

it('администратор выгружает любую группу; чужой преподаватель и ученик — нет', async () => {
  const { t } = await filledGroup();
  const other = await setupTeacher(['Чужой Ученик']);
  const account = await prisma.account.create({ data: {
    login: `admin.${randomUUID().slice(0, 8)}`, role: 'ADMIN', passwordHash: await hashPassword('admin-test-123'),
    admin: { create: { name: 'Директор школы' } },
  } });
  const admin = await login(account.login, 'admin-test-123');
  expect(Object.keys((await unzip(`/api/admin/groups/${t.group.id}/export`, admin)).files)).toHaveLength(8);
  expect((await call('GET', '/api/admin/groups/nope/export', { cookie: admin })).status).toBe(404);
  expect((await call('GET', `/api/admin/groups/${t.group.id}/export`, { cookie: t.cookie })).status).toBe(403);
  expect((await call('GET', `/api/teacher/groups/${t.group.id}/export`, { cookie: other.cookie })).status).toBe(404);
  expect((await call('GET', `/api/teacher/groups/${t.group.id}/export`, { cookie: await t.studentCookie(0) })).status).toBe(403);
});

it('срок хранения: файлы группы удаляются через ARCHIVED_FILES_DAYS после переноса в архив, сама группа остаётся', async () => {
  const { t, media } = await filledGroup();
  const fresh = await filledGroup();
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  await call('POST', `/api/teacher/groups/${fresh.t.group.id}/archive`, { cookie: fresh.t.cookie });
  const details = (await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).body.group;
  expect(details).toMatchObject({ filesKeptDays: 365 });
  expect(new Date(details.filesExpireAt).getTime()).toBe(addDays(new Date(details.archivedAt), 365).getTime());

  await prisma.group.update({ where: { id: t.group.id }, data: { archivedAt: addDays(new Date(), -366) } });
  expect(await expireArchivedFiles()).toBe(7);
  expect(await prisma.storedFile.count({ where: { OR: [{ groupId: t.group.id }, { student: { groupId: t.group.id } }] } })).toBe(0);
  expect(await storedSize(media[0].id)).toBeNull();
  expect(await prisma.storedFile.count({ where: { groupId: fresh.t.group.id } })).toBe(5);
  expect((await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).status).toBe(200);
  // Архив после удаления пустой, но скачивается: внутри одно пояснение
  expect(Object.keys((await unzip(`/api/teacher/groups/${t.group.id}/export`, t.cookie)).files)).toEqual(['Что в архиве.txt']);
});
