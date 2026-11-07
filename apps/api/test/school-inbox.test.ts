import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { SchoolRole } from '../src/generated/prisma/client';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

const PDF = Buffer.from('%PDF-1.7 справка');

async function setupSchool(name: string) {
  const school = await prisma.school.create({ data: { name } });
  const staff = async (role: SchoolRole, person: string) => {
    const loginName = `staff.${randomUUID().slice(0, 8)}`;
    await prisma.admin.create({
      data: {
        name: person, role, school: { connect: { id: school.id } },
        account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
      },
    });
    return login(loginName, 'staff-test-123');
  };
  return { school, staff };
}

async function parentOf(t: Awaited<ReturnType<typeof setupTeacher>>) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  return { cookie: await login(issued.login, issued.password), id: issued.parentId as string };
}

function withFile(text: string) {
  const data = new FormData();
  data.append('text', text);
  data.append('file', new File([PDF], 'справка.pdf'));
  return data;
}

it('родитель пишет школе со справкой; любой сотрудник видит и отвечает; ожидание ответа и прочтение', async () => {
  const s = await setupSchool('Северная школа');
  const secretary = await s.staff('STAFF', 'Ольга Секретарь');
  const director = await s.staff('DIRECTOR', 'Ирина Львовна');
  const t = await setupTeacher(['Маша Иванова'], s.school.id);
  const parent = await parentOf(t);

  const [mine] = (await call('GET', '/api/parent/school-messages', { cookie: parent.cookie })).body;
  expect(mine).toEqual({ schoolId: s.school.id, schoolName: 'Северная школа', messages: [] });
  const path = `/api/parent/school-messages/${s.school.id}`;
  const sent = await call('POST', path, { cookie: parent.cookie, raw: withFile('Маша болела, справка') });
  expect(sent.status).toBe(201);
  expect(sent.body[0]).toMatchObject({ text: 'Маша болела, справка', mine: true, author: 'Родитель', files: [{ name: 'справка.pdf' }] });
  const fileId = sent.body[0].files[0].id;

  for (const cookie of [secretary, director]) expect((await call('GET', '/api/notifications', { cookie })).body.schoolInbox).toBe(1);
  const [row] = (await call('GET', '/api/admin/inbox', { cookie: secretary })).body;
  expect(row).toMatchObject({ family: `Родитель: Маша Иванова (${t.group.name})`, lastText: 'Маша болела, справка', waiting: true });
  expect((await call('GET', `/api/files/${fileId}`, { cookie: secretary })).status).toBe(200);
  expect((await call('GET', `/api/files/${fileId}`, { cookie: t.cookie })).status).toBe(404);

  const body = { text: 'Спасибо, передали классному руководителю' };
  const reply = await call('POST', `/api/admin/inbox/${row.id}`, { cookie: secretary, body });
  expect(reply.body).toMatchObject({ waiting: false, lastFromSchool: true });
  expect(reply.body.messages.map((m: { author: string; mine: boolean }) => [m.author, m.mine])).toEqual([
    ['Родитель', false],
    ['Ольга Секретарь, администрация школы', true],
  ]);
  expect((await call('GET', '/api/notifications', { cookie: director })).body.schoolInbox).toBe(0);
  expect((await call('GET', `/api/admin/inbox/${row.id}`, { cookie: director })).body.messages[1].mine).toBe(false);

  expect((await call('GET', '/api/notifications', { cookie: parent.cookie })).body.schoolInbox).toBe(1);
  const read = (await call('GET', '/api/parent/school-messages', { cookie: parent.cookie })).body[0];
  expect(read.messages[1]).toMatchObject({ author: 'Ольга Секретарь, администрация школы', fromParent: false });
  expect((await call('GET', '/api/notifications', { cookie: parent.cookie })).body.schoolInbox).toBe(0);

  // Новое сообщение родителя снова ждёт ответа; решить вопрос можно и без письма
  await call('POST', path, { cookie: parent.cookie, body: { text: 'А когда собрание?' } });
  const [waitingAgain] = (await call('GET', '/api/admin/inbox', { cookie: director })).body;
  expect(waitingAgain).toMatchObject({ waiting: true, lastText: 'А когда собрание?' });
  expect((await call('POST', `/api/admin/inbox/${row.id}/handled`, { cookie: director })).body.waiting).toBe(false);
  expect((await call('GET', '/api/notifications', { cookie: director })).body.schoolInbox).toBe(0);
});

it('ящик закрыт для чужих: другая школа, другой родитель, ученик и преподаватель', async () => {
  const north = await setupSchool('Северная школа');
  const south = await setupSchool('Южная школа');
  const northStaff = await north.staff('DEPUTY', 'Завуч севера');
  const southStaff = await south.staff('DIRECTOR', 'Директор юга');
  const t = await setupTeacher(['Маша Иванова'], north.school.id);
  const other = await setupTeacher(['Петя Смирнов'], south.school.id);
  const parent = await parentOf(t);
  const stranger = await parentOf(other);

  const path = `/api/parent/school-messages/${north.school.id}`;
  const sent = (await call('POST', path, { cookie: parent.cookie, raw: withFile('Вопрос') })).body;
  const fileId = sent[0].files[0].id;
  const [row] = (await call('GET', '/api/admin/inbox', { cookie: northStaff })).body;

  expect((await call('POST', path, { cookie: stranger.cookie, body: { text: 'Я чужой' } })).status).toBe(404);
  expect((await call('GET', '/api/admin/inbox', { cookie: southStaff })).body).toEqual([]);
  expect((await call('GET', `/api/admin/inbox/${row.id}`, { cookie: southStaff })).status).toBe(404);
  expect((await call('POST', `/api/admin/inbox/${row.id}`, { cookie: southStaff, body: { text: 'Не моё' } })).status).toBe(404);
  expect((await call('POST', `/api/admin/inbox/${row.id}/handled`, { cookie: southStaff })).status).toBe(404);
  for (const cookie of [southStaff, stranger.cookie, t.cookie, await t.studentCookie(0)]) {
    expect((await call('GET', `/api/files/${fileId}`, { cookie })).status).toBe(404);
  }
  expect((await call('GET', '/api/parent/school-messages', { cookie: t.cookie })).status).toBe(403);

  // Семья ушла из школы: группа в архиве, переписка и файлы ей больше недоступны, а у школы остаются
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await call('GET', '/api/parent/school-messages', { cookie: parent.cookie })).body).toEqual([]);
  expect((await call('GET', `/api/files/${fileId}`, { cookie: parent.cookie })).status).toBe(404);
  expect((await call('GET', `/api/admin/inbox/${row.id}`, { cookie: northStaff })).body.messages).toHaveLength(1);
});

it('пустое сообщение не уходит; без ответа школы родитель пишет не больше 20 сообщений подряд', async () => {
  const s = await setupSchool('Северная школа');
  const staff = await s.staff('STAFF', 'Секретарь');
  const t = await setupTeacher(['Маша Иванова'], s.school.id);
  const parent = await parentOf(t);
  const path = `/api/parent/school-messages/${s.school.id}`;
  expect((await call('POST', path, { cookie: parent.cookie, body: { text: '  ' } })).status).toBe(400);
  for (let i = 0; i < 20; i++) await call('POST', path, { cookie: parent.cookie, body: { text: `Вопрос ${i}` } });
  expect((await call('POST', path, { cookie: parent.cookie, body: { text: 'Ещё' } })).status).toBe(409);
  const [row] = (await call('GET', '/api/admin/inbox', { cookie: staff })).body;
  await call('POST', `/api/admin/inbox/${row.id}`, { cookie: staff, body: { text: 'Ответили' } });
  expect((await call('POST', path, { cookie: parent.cookie, body: { text: 'Спасибо' } })).status).toBe(201);
});
