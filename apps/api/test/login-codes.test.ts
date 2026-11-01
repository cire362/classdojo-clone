import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const path = (t: Teacher) => `/api/teacher/groups/${t.group.id}`;
const ip = () => ({ 'x-real-ip': randomUUID() });
const issue = async (t: Teacher, studentIds?: string[]) =>
  (await call('POST', `${path(t)}/login-cards`, { cookie: t.cookie, body: { studentIds } })).body.cards;
const byCard = (token: string, headers = ip()) => call('POST', '/api/auth/qr', { body: { token }, headers });
const openCode = async (t: Teacher) => (await call('POST', `${path(t)}/class-code`, { cookie: t.cookie })).body;
const roster = (code: string, headers = ip()) => call('POST', '/api/auth/class-code', { body: { code }, headers });
const byCode = (code: string, studentId: string, headers = ip()) =>
  call('POST', '/api/auth/class-code/login', { body: { code, studentId }, headers });

it('карточка входит в кабинет ученика, в базе остаётся только хеш', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const cards = await issue(t);
  expect(cards.map((c: { name: string }) => c.name)).toEqual(['Маша Иванова', 'Петя Смирнов']);
  const res = await byCard(cards[0].token);
  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({ role: 'STUDENT', name: 'Маша Иванова' });
  // Старая сессия снимается первой, браузер применяет заголовки по порядку
  const cookie = res.headers.getSetCookie().at(-1)!.split(';')[0];
  expect((await call('GET', '/api/student/profile', { cookie })).body.student.name).toBe('Маша Иванова');
  const stored = await prisma.loginCard.findUnique({ where: { studentId: cards[0].studentId } });
  expect(stored?.tokenHash).not.toContain(cards[0].token);
  expect(stored?.tokenHash).toHaveLength(64);
});

it('карточку можно выпустить одному ученику, новая отменяет старую', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const [first, petya] = await issue(t);
  const [second, ...rest] = await issue(t, [first.studentId]);
  expect(rest).toEqual([]);
  expect((await byCard(first.token)).status).toBe(400);
  expect((await byCard(second.token)).status).toBe(200);
  expect((await byCard(petya.token)).status).toBe(200);
});

it('просроченная карточка не работает; новый пароль отменяет карточку', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const [masha, petya] = await issue(t);
  await prisma.loginCard.update({ where: { studentId: masha.studentId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await byCard(masha.token)).status).toBe(400);
  await call('POST', `/api/teacher/students/${petya.studentId}/reset-password`, { cookie: t.cookie });
  expect((await byCard(petya.token)).status).toBe(400);
});

it('код класса показывает имена коротко и входит за выбранного ученика', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Оля']);
  const { code, expiresAt } = await openCode(t);
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 44 * 60_000);
  expect((await call('GET', `${path(t)}/class-code`, { cookie: t.cookie })).body).toEqual({ code, expiresAt });
  const list = await roster(` ${code.toLowerCase()} `);
  expect(list.body.students.map((s: { name: string }) => s.name)).toEqual(['Маша И.', 'Оля']);
  expect(JSON.stringify(list.body)).not.toContain('Иванова');
  const res = await byCode(code, list.body.students[0].id);
  expect(res.body.user).toMatchObject({ role: 'STUDENT', name: 'Маша Иванова' });
});

it('новый код отменяет старый; отключённый, просроченный и архивный не работают', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const student = t.students[0].id;
  const first = (await openCode(t)).code;
  const second = (await openCode(t)).code;
  expect(first).not.toBe(second);
  expect((await roster(first)).status).toBe(400);
  await prisma.classCode.update({ where: { groupId: t.group.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await roster(second)).status).toBe(400);
  expect((await byCode(second, student)).status).toBe(400);
  expect((await call('GET', `${path(t)}/class-code`, { cookie: t.cookie })).body).toBeNull();
  const third = (await openCode(t)).code;
  await call('DELETE', `${path(t)}/class-code`, { cookie: t.cookie });
  expect((await roster(third)).status).toBe(400);
  const fourth = (await openCode(t)).code;
  await call('POST', `${path(t)}/archive`, { cookie: t.cookie });
  expect((await roster(fourth)).status).toBe(400);
  expect((await call('POST', `${path(t)}/class-code`, { cookie: t.cookie })).status).toBe(409);
  expect((await call('POST', `${path(t)}/login-cards`, { cookie: t.cookie })).status).toBe(409);
});

it('код класса не впускает за ученика другой группы', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Смирнов']);
  const { code } = await openCode(t);
  expect((await byCode(code, other.students[0].id)).status).toBe(400);
});

it('чужой преподаватель не выпускает карточки и не видит код', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Смирнов']);
  await openCode(t);
  expect((await call('POST', `${path(t)}/login-cards`, { cookie: other.cookie })).status).toBe(404);
  expect((await call('GET', `${path(t)}/class-code`, { cookie: other.cookie })).status).toBe(404);
  expect((await call('DELETE', `${path(t)}/class-code`, { cookie: other.cookie })).status).toBe(404);
  const cards = await issue(t, [other.students[0].id]);
  expect(cards).toEqual([]);
});

it('перебор останавливается общим лимитом, а верные коды целого класса его не тратят', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { code } = await openCode(t);
  const school = ip();
  for (let i = 0; i < 100; i++) expect((await roster(code, school)).status).toBe(200);
  for (let i = 0; i < 60; i++) expect((await roster('NOPE22', school)).status).toBe(400);
  const blocked = await roster(code, school);
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get('retry-after')).toBeTruthy();
  expect((await byCard('wrong-token', school)).status).toBe(429);
  expect((await byCode(code, t.students[0].id, school)).status).toBe(429);
  expect((await roster(code)).status).toBe(200);
});

it('запрос без клиентского заголовка отклоняется', async () => {
  expect((await call('POST', '/api/auth/qr', { body: { token: 'x' }, noClientHeader: true })).status).toBe(403);
});
