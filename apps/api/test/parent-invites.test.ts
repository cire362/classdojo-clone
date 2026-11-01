import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const PASSWORD = 'мой-пароль-123';
const ip = () => ({ 'x-real-ip': randomUUID() });
const invite = async (t: Teacher, index = 0) =>
  (await call('POST', `/api/teacher/students/${t.students[index].id}/parent-invites`, { cookie: t.cookie })).body;
const accept = (code: string, password = PASSWORD, headers = ip()) => call('POST', '/api/auth/invite/accept', { body: { code, password }, headers });

it('родитель сам задаёт пароль и входит; логин выдаётся автоматически', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const created = await invite(t);
  expect(created.code).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
  const preview = await call('POST', '/api/auth/invite', { body: { code: created.code }, headers: ip() });
  expect(preview.body).toEqual({ studentName: 'Маша Иванова', groupName: 'Тестовая группа' });
  const res = await accept(created.code);
  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({ role: 'PARENT', name: 'Родитель: Маша Иванова' });
  expect(res.body.login).toMatch(/^parent\.masha\.i\d*$/);
  const cookie = await login(res.body.login, PASSWORD);
  expect((await call('GET', '/api/parent/children', { cookie })).body[0].name).toBe('Маша Иванова');
});

it('код принимается с разделителем и в нижнем регистре, в базе только хеш', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { id, code } = await invite(t);
  const stored = await prisma.parentInvite.findUniqueOrThrow({ where: { id } });
  expect(stored.codeHash).not.toContain(code);
  const typed = `${code.slice(0, 5)}-${code.slice(5)}`.toLowerCase();
  expect((await accept(typed)).status).toBe(200);
});

it('приглашение одноразовое, в том числе при двух одновременных запросах', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { code } = await invite(t);
  const [first, second] = await Promise.all([accept(code), accept(code)]);
  expect([first.status, second.status].filter((s) => s === 200)).toHaveLength(1);
  expect((await accept(code)).status).toBe(400);
  expect(await prisma.parentStudent.count({ where: { studentId: t.students[0].id } })).toBe(1);
});

it('слабый пароль не тратит приглашение', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { code } = await invite(t);
  expect((await accept(code, 'короткий'.slice(0, 7))).status).toBe(400);
  expect((await accept(code)).status).toBe(200);
});

it('просроченное, отозванное и архивное приглашение не работают', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const student = t.students[0].id;
  const expired = await invite(t);
  await prisma.parentInvite.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await accept(expired.code)).status).toBe(400);
  const list = `/api/teacher/students/${student}/parent-invites`;
  const revoked = await invite(t);
  expect((await call('GET', list, { cookie: t.cookie })).body.map((i: { id: string }) => i.id)).toEqual([revoked.id]);
  expect((await call('DELETE', `${list}/${revoked.id}`, { cookie: t.cookie })).status).toBe(200);
  expect((await call('DELETE', `${list}/${revoked.id}`, { cookie: t.cookie })).status).toBe(404);
  expect((await accept(revoked.code)).status).toBe(400);
  const archived = await invite(t);
  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await accept(archived.code)).status).toBe(400);
  expect((await call('POST', list, { cookie: t.cookie })).status).toBe(409);
});

it('входов и приглашений вместе не больше четырёх на ученика', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const first = await invite(t);
  await accept(first.code);
  for (let i = 0; i < 3; i++) expect((await invite(t)).code).toBeTruthy();
  const extra = await call('POST', `/api/teacher/students/${t.students[0].id}/parent-invites`, { cookie: t.cookie });
  expect(extra.status).toBe(400);
});

it('родитель с готовым входом добавляет второго ребёнка, повтор отклоняется', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Ваня Иванов']);
  const first = await accept((await invite(t, 0)).code);
  const cookie = await login(first.body.login, PASSWORD);
  const code = (await invite(t, 1)).code;
  const res = await call('POST', '/api/parent/invite', { cookie, body: { code }, headers: ip() });
  expect(res.body.studentName).toBe('Ваня Иванов');
  expect((await call('GET', '/api/parent/children', { cookie })).body).toHaveLength(2);
  const again = await call('POST', '/api/parent/invite', { cookie, body: { code: (await invite(t, 1)).code }, headers: ip() });
  expect(again.status).toBe(409);
  expect((await call('POST', '/api/parent/invite', { body: { code }, headers: ip() })).status).toBe(401);
  expect((await call('POST', '/api/parent/invite', { cookie: t.cookie, body: { code }, headers: ip() })).status).toBe(403);
});

it('лист на собрание: только ученикам без родителей, прежние приглашения заменяются', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов', 'Оля Котова']);
  await accept((await invite(t, 0)).code);
  const old = await invite(t, 1);
  const path = `/api/teacher/groups/${t.group.id}/parent-invites`;
  const { invites } = (await call('POST', path, { cookie: t.cookie })).body;
  expect(invites.map((i: { studentName: string }) => i.studentName)).toEqual(['Оля Котова', 'Петя Смирнов']);
  expect((await accept(old.code)).status).toBe(400);
  expect((await accept(invites[1].code)).status).toBe(200);
});

it('чужой преподаватель не видит и не создаёт приглашения', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Смирнов']);
  const list = `/api/teacher/students/${t.students[0].id}/parent-invites`;
  expect((await call('GET', list, { cookie: other.cookie })).status).toBe(404);
  expect((await call('POST', list, { cookie: other.cookie })).status).toBe(404);
  const { id } = await invite(t);
  expect((await call('DELETE', `${list}/${id}`, { cookie: other.cookie })).status).toBe(404);
  expect((await call('POST', `/api/teacher/groups/${t.group.id}/parent-invites`, { cookie: other.cookie })).status).toBe(404);
});

it('перебор приглашений упирается в общий лимит кодов', async () => {
  const school = ip();
  for (let i = 0; i < 60; i++) {
    expect((await call('POST', '/api/auth/invite', { body: { code: 'ZZZZZZZZZZ' }, headers: school })).status).toBe(400);
  }
  expect((await call('POST', '/api/auth/invite', { body: { code: 'ZZZZZZZZZZ' }, headers: school })).status).toBe(429);
  expect((await call('POST', '/api/auth/qr', { body: { token: 'x' }, headers: school })).status).toBe(429);
});
