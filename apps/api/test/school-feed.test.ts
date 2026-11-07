import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { SchoolRole } from '../src/generated/prisma/client';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

const JPEG = await picture(40, 30, 'image/jpeg');
const PDF = Buffer.from('%PDF-1.7 объявление');

async function setupSchool(name: string) {
  const school = await prisma.school.create({ data: { name } });
  const staff = async (role: SchoolRole) => {
    const loginName = `staff.${randomUUID().slice(0, 8)}`;
    await prisma.admin.create({
      data: {
        name: `Завуч ${name}`, role, school: { connect: { id: school.id } },
        account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
      },
    });
    return login(loginName, 'staff-test-123');
  };
  return { school, director: await staff('DEPUTY'), staff };
}

function form(text: string, important = false, files: [string, Uint8Array][] = []) {
  const data = new FormData();
  data.append('text', text);
  if (important) data.append('important', 'true');
  for (const [name, bytes] of files) data.append('file', new File([bytes as BlobPart], name));
  return data;
}

async function parentOf(t: Awaited<ReturnType<typeof setupTeacher>>, index = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[index].id}/parents`, { cookie: t.cookie })).body;
  return login(issued.login, issued.password);
}

it('запись школы видят её преподаватели и семьи; ученики и чужая школа — нет; просмотр отмечает прочитанным', async () => {
  const north = await setupSchool('Северная школа');
  const south = await setupSchool('Южная школа');
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов'], north.school.id);
  const foreign = await setupTeacher(['Оля Котова'], south.school.id);
  const parent = await parentOf(t);
  const foreignParent = await parentOf(foreign);
  const pupil = await t.studentCookie(0);

  const created = await call('POST', '/api/admin/school-feed', {
    cookie: north.director, raw: form('Собрание в пятницу в 18:00', true, [['план.pdf', PDF], ['зал.jpg', JPEG]]),
  });
  expect(created.status).toBe(201);
  expect(created.body[0]).toMatchObject({ text: 'Собрание в пятницу в 18:00', important: true, author: 'Завуч Северная школа' });
  expect(created.body[0].reach).toEqual({ read: 0, total: 1, audience: 'families' });
  const [pdf, photo] = created.body[0].files;

  for (const cookie of [t.cookie, parent]) expect((await call('GET', '/api/notifications', { cookie })).body.school).toBe(1);
  const feed = (await call('GET', '/api/school-feed', { cookie: parent })).body;
  expect(feed).toHaveLength(1);
  expect(feed[0]).toMatchObject({
    schoolName: 'Северная школа', important: true, unread: true, files: [{ name: 'план.pdf' }, { name: 'зал.jpg' }],
  });
  expect((await call('GET', '/api/notifications', { cookie: parent })).body.school).toBe(0);
  expect((await call('GET', '/api/school-feed', { cookie: parent })).body[0].unread).toBe(false);
  const afterRead = (await call('GET', '/api/admin/school-feed', { cookie: north.director })).body[0];
  expect(afterRead.reach).toEqual({ read: 1, total: 1, audience: 'families' });
  expect((await call('GET', `/api/files/${photo.id}?size=preview`, { cookie: parent })).status).toBe(200);
  expect((await call('GET', `/api/files/${pdf.id}`, { cookie: t.cookie })).status).toBe(200);

  expect((await call('GET', '/api/school-feed', { cookie: pupil })).status).toBe(403);
  expect((await call('GET', `/api/files/${pdf.id}`, { cookie: pupil })).status).toBe(404);
  for (const cookie of [foreign.cookie, foreignParent, south.director]) {
    expect((await call('GET', `/api/files/${pdf.id}`, { cookie })).status).toBe(404);
  }
  expect((await call('GET', '/api/school-feed', { cookie: foreignParent })).body).toEqual([]);
  expect((await call('GET', '/api/admin/school-feed', { cookie: south.director })).body).toEqual([]);
  expect((await call('DELETE', `/api/admin/school-feed/${created.body[0].id}`, { cookie: south.director })).status).toBe(404);

  // Группу перевели в архив: семья больше не получает новости этой школы
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await call('GET', '/api/school-feed', { cookie: parent })).body).toEqual([]);
  expect((await call('GET', `/api/files/${pdf.id}`, { cookie: parent })).status).toBe(404);
});

it('родитель детей из разных школ видит обе ленты с названием школы', async () => {
  const north = await setupSchool('Северная школа');
  const south = await setupSchool('Южная школа');
  const t = await setupTeacher(['Маша Иванова'], north.school.id);
  const other = await setupTeacher(['Петя Иванов'], south.school.id);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  await prisma.parentStudent.create({ data: { parentId: issued.parentId, studentId: other.students[0].id } });
  const parent = await login(issued.login, issued.password);
  await call('POST', '/api/admin/school-feed', { cookie: north.director, raw: form('Новости севера') });
  await call('POST', '/api/admin/school-feed', { cookie: south.director, raw: form('Новости юга') });
  expect((await call('GET', '/api/notifications', { cookie: parent })).body.school).toBe(2);
  const feed = (await call('GET', '/api/school-feed', { cookie: parent })).body;
  expect(feed.map((p: { schoolName: string; text: string }) => [p.schoolName, p.text])).toEqual([
    ['Южная школа', 'Новости юга'],
    ['Северная школа', 'Новости севера'],
  ]);
});

it('писать и удалять могут директор и завуч; пустая запись и лишние файлы не проходят; удаление уносит файлы', async () => {
  const s = await setupSchool('Северная школа');
  const clerk = await s.staff('STAFF');
  expect((await call('GET', '/api/admin/school-feed', { cookie: clerk })).status).toBe(200);
  expect((await call('POST', '/api/admin/school-feed', { cookie: clerk, raw: form('Привет') })).status).toBe(403);
  expect((await call('POST', '/api/admin/school-feed', { cookie: s.director, raw: form('  ') })).status).toBe(400);
  const many = Array.from({ length: 6 }, (_, i): [string, Uint8Array] => [`${i}.pdf`, PDF]);
  expect((await call('POST', '/api/admin/school-feed', { cookie: s.director, raw: form('Много', false, many) })).status).toBe(400);
  const text = form('Файл', false, [['a.txt', Buffer.from('hi')]]);
  expect((await call('POST', '/api/admin/school-feed', { cookie: s.director, raw: text })).status).toBe(415);

  const [post] = (await call('POST', '/api/admin/school-feed', { cookie: s.director, raw: form('', false, [['фото.jpg', JPEG]]) })).body;
  expect(post).toMatchObject({ text: '', important: false, reach: null });
  expect((await call('DELETE', `/api/admin/school-feed/${post.id}`, { cookie: clerk })).status).toBe(403);
  expect((await call('DELETE', `/api/admin/school-feed/${post.id}`, { cookie: s.director })).body).toEqual([]);
  expect(await prisma.storedFile.count({ where: { id: post.files[0].id } })).toBe(0);
});
