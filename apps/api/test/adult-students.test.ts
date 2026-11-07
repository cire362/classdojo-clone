import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { InstitutionKind } from '../src/generated/prisma/client';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function setupInstitution(kind: InstitutionKind, name: string) {
  const school = await prisma.school.create({ data: { name, kind } });
  const loginName = `staff.${randomUUID().slice(0, 8)}`;
  await prisma.admin.create({
    data: {
      name: 'Ирина Львовна', role: 'DIRECTOR', school: { connect: { id: school.id } },
      account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
    },
  });
  return { school, director: await login(loginName, 'staff-test-123') };
}

it('в колледже и вузе родители в новой группе выключены; выключение отзывает приглашения, выданные входы остаются', async () => {
  const uni = await setupInstitution('UNIVERSITY', 'Политех');
  const t = await setupTeacher(['Маша Иванова'], uni.school.id);
  const created = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'ИВТ-21' } })).body;
  expect((await call('GET', `/api/teacher/groups/${created.id}`, { cookie: t.cookie })).body.group.parentsEnabled).toBe(false);
  const school = await setupTeacher(['Петя Смирнов']);
  const schoolGroup = (await call('POST', '/api/teacher/groups', { cookie: school.cookie, body: { name: '5 «А»' } })).body;
  expect((await call('GET', `/api/teacher/groups/${schoolGroup.id}`, { cookie: school.cookie })).body.group.parentsEnabled).toBe(true);

  // Группа из помощника тестов создана с родителями: выдаём вход и приглашение, затем выключаем
  const student = t.students[0].id;
  const issued = (await call('POST', `/api/teacher/students/${student}/parents`, { cookie: t.cookie })).body;
  const invite = (await call('POST', `/api/teacher/students/${student}/parent-invites`, { cookie: t.cookie })).body;
  await call('PATCH', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie, body: { parentsEnabled: false } });
  const disabled = 'Родители в этой группе выключены. Включите их в настройках группы';
  for (const path of [`/api/teacher/students/${student}/parents`, `/api/teacher/students/${student}/parent-invites`,
    `/api/teacher/groups/${t.group.id}/parents`, `/api/teacher/groups/${t.group.id}/parent-invites`]) {
    expect(await call('POST', path, { cookie: t.cookie })).toMatchObject({ status: 409, body: { error: disabled } });
  }
  expect((await call('POST', '/api/auth/invite', { body: { code: invite.code } })).status).toBe(400);
  expect((await call('GET', '/api/parent/children', { cookie: await login(issued.login, issued.password) })).status).toBe(200);

  await call('PATCH', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie, body: { parentsEnabled: true } });
  expect((await call('POST', `/api/teacher/students/${student}/parents`, { cookie: t.cookie })).status).toBe(200);
});

it('студент вуза читает ленту учреждения и пишет в ящик; объявление считает прочитавших студентов', async () => {
  const uni = await setupInstitution('UNIVERSITY', 'Политех');
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов'], uni.school.id);
  const masha = await t.studentCookie(0);
  const pupil = await (await setupTeacher(['Оля Котова'])).studentCookie(0);

  const form = new FormData();
  form.append('text', 'Сессия начинается 10 января');
  form.append('important', 'true');
  const [post] = (await call('POST', '/api/admin/school-feed', { cookie: uni.director, raw: form })).body;
  expect(post.reach).toEqual({ read: 0, total: 2, audience: 'students' });
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.school).toBe(1);
  const feed = (await call('GET', '/api/school-feed', { cookie: masha })).body;
  expect(feed).toMatchObject([{ schoolName: 'Политех', text: 'Сессия начинается 10 января', unread: true }]);
  expect((await call('GET', '/api/admin/school-feed', { cookie: uni.director })).body[0].reach).toMatchObject({ read: 1, total: 2 });
  expect((await call('GET', '/api/school-feed', { cookie: pupil })).status).toBe(403);
  expect((await call('GET', '/api/student/school-messages', { cookie: pupil })).body).toEqual([]);

  const [mine] = (await call('GET', '/api/student/school-messages', { cookie: masha })).body;
  expect(mine).toMatchObject({ schoolId: uni.school.id, schoolName: 'Политех', messages: [] });
  const path = `/api/student/school-messages/${uni.school.id}`;
  const sent = (await call('POST', path, { cookie: masha, body: { text: 'Нужна справка об обучении' } })).body;
  expect(sent[0]).toMatchObject({ mine: true, author: 'Студент' });
  const [row] = (await call('GET', '/api/admin/inbox', { cookie: uni.director })).body;
  expect(row).toMatchObject({ family: `Студент: Маша Иванова (${t.group.name})`, waiting: true });
  await call('POST', `/api/admin/inbox/${row.id}`, { cookie: uni.director, body: { text: 'Готова, заберите в деканате' } });
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.schoolInbox).toBe(1);
  const read = (await call('GET', '/api/student/school-messages', { cookie: masha })).body[0];
  expect(read.messages[1]).toMatchObject({ author: 'Ирина Львовна, администрация вуза', mine: false });
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.schoolInbox).toBe(0);
  // Другой студент чужую переписку не видит
  const petya = await t.studentCookie(1);
  expect((await call('GET', '/api/student/school-messages', { cookie: petya })).body[0].messages).toEqual([]);
});
