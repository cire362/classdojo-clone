import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { trendPeriod } from '../src/modules/reports/index.js';
import { call, setupTeacher } from './helpers.js';

it('график: границы по Москве, смена года, пустые недели и точное обрезание периода', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const studentId = t.students[0].id;
  await prisma.pointEvent.createMany({ data: [
    ['2025-12-30T20:59:59.999Z', 100], ['2025-12-30T21:00:00Z', 4],
    ['2026-01-04T20:59:59.999Z', 2], ['2026-01-04T21:00:00Z', -3],
    ['2026-01-12T20:59:59.999Z', 1], ['2026-01-12T21:00:00Z', 100],
  ].map(([at, value]) => ({ studentId, reasonName: 'Работа', emoji: '⭐', createdAt: new Date(at as string), value: value as number })) });
  const path = `/api/teacher/groups/${t.group.id}/stats/weekly?from=2025-12-31&to=2026-01-12`;
  const res = await call('GET', path, { cookie: t.cookie });
  expect(res.status).toBe(200);
  expect(res.body.points).toEqual({ earned: 7, lost: 3, net: 4, events: 4 });
  expect(res.body.weeks).toEqual([
    { week: '2025-12-29', from: '2025-12-31', to: '2026-01-04', partial: true, earned: 6, lost: 0, net: 6, events: 2 },
    { week: '2026-01-05', from: '2026-01-05', to: '2026-01-11', partial: false, earned: 0, lost: 3, net: -3, events: 1 },
    { week: '2026-01-12', from: '2026-01-12', to: '2026-01-12', partial: true, earned: 1, lost: 0, net: 1, events: 1 },
  ]);
  const table = await call('GET', `/api/teacher/groups/${t.group.id}/stats?from=2025-12-31&to=2026-01-12`, { cookie: t.cookie });
  expect(res.body.points.net).toBe(table.body.students[0].net);
});

it('ученик и команда: текущий состав, исправления истории и отсутствие лимита 300', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const [masha, petya] = t.students;
  const team = await prisma.team.create({ data: { groupId: t.group.id, name: 'Кометы', color: '#8b5cf6' } });
  await prisma.student.update({ where: { id: masha.id }, data: { teamId: team.id } });
  await prisma.pointEvent.createMany({ data: Array.from({ length: 305 }, () => ({ studentId: masha.id, reasonName: 'Работа', emoji: '⭐', value: 1, createdAt: new Date('2026-01-01T12:00:00Z') })) });
  const event = await prisma.pointEvent.create({ data: { studentId: petya.id, reasonName: 'Ошибка', emoji: '⭐', value: -3, createdAt: new Date('2026-01-01T12:00:00Z') } });
  const path = `/api/teacher/groups/${t.group.id}/stats/weekly?from=2026-01-01&to=2026-01-31`;
  let res = await call('GET', `${path}&teamId=${team.id}`, { cookie: t.cookie });
  expect(res.body).toMatchObject({ members: 1, points: { earned: 305, lost: 0, net: 305 }, scope: { kind: 'team', name: 'Кометы' } });
  expect(res.body.weeks).toHaveLength(5);
  expect(res.body.weeks[1].net).toBe(0);
  expect((await call('GET', `${path}&studentId=${petya.id}`, { cookie: t.cookie })).body.points.net).toBe(-3);
  await prisma.student.update({ where: { id: petya.id }, data: { teamId: team.id } });
  res = await call('GET', `${path}&teamId=${team.id}`, { cookie: t.cookie });
  expect(res.body.points.net).toBe(302);
  await prisma.pointEvent.delete({ where: { id: event.id } });
  expect((await call('GET', `${path}&teamId=${team.id}`, { cookie: t.cookie })).body.points.net).toBe(305);
});

it('пустая команда и группа сохраняют нулевые недели, архив доступен для чтения', async () => {
  const t = await setupTeacher([]);
  const team = await prisma.team.create({ data: { groupId: t.group.id, name: 'Пустая', color: '#123456' } });
  await prisma.group.update({ where: { id: t.group.id }, data: { archivedAt: new Date() } });
  const res = await call('GET', `/api/teacher/groups/${t.group.id}/stats/weekly?from=2026-01-05&to=2026-01-11&teamId=${team.id}`, { cookie: t.cookie });
  expect(res.status).toBe(200);
  expect(res.body.members).toBe(0);
  expect(res.body.weeks).toEqual([{ week: '2026-01-05', from: '2026-01-05', to: '2026-01-11', partial: false, earned: 0, lost: 0, net: 0, events: 0 }]);
  const far = await call('GET', `/api/teacher/groups/${t.group.id}/stats/weekly?from=9999-12-01&to=9999-12-31`, { cookie: t.cookie });
  expect(far.status).toBe(200);
  expect(far.body.weeks.length).toBeLessThanOrEqual(6);
  expect(far.body.weeks.at(-1).to).toBe('9999-12-31');
});

it('доступ к группе, ученику и команде изолирован; соавтор видит график', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Другой Ученик']);
  const team = await prisma.team.create({ data: { groupId: other.group.id, name: 'Чужая', color: '#123456' } });
  const path = `/api/teacher/groups/${t.group.id}/stats/weekly`;
  expect((await call('GET', path)).status).toBe(401);
  expect((await call('GET', path, { cookie: await t.studentCookie(0) })).status).toBe(403);
  expect((await call('GET', path, { cookie: other.cookie })).status).toBe(404);
  for (const suffix of [`?studentId=${other.students[0].id}`, `?teamId=${team.id}`]) expect((await call('GET', path + suffix, { cookie: t.cookie })).status).toBe(404);
  expect((await call('GET', `${path}?studentId=${t.students[0].id}&teamId=${team.id}`, { cookie: t.cookie })).status).toBe(400);
  await prisma.group.update({ where: { id: t.group.id }, data: { coTeachers: { create: { teacherId: other.teacher.id } } } });
  expect((await call('GET', path, { cookie: other.cookie })).status).toBe(200);
});

it('после перевода история считается в текущей группе и не остаётся в старой команде', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const sid = t.students[0].id;
  const target = await prisma.group.create({ data: { name: 'Новая', teacherId: t.teacher.id } });
  await prisma.pointEvent.create({ data: { studentId: sid, reasonName: 'Работа', emoji: '⭐', value: 7, createdAt: new Date('2026-01-01T12:00:00Z') } });
  await call('POST', `/api/teacher/students/${sid}/move`, { cookie: t.cookie, body: { groupId: target.id } });
  const path = (id: string) => `/api/teacher/groups/${id}/stats/weekly?from=2026-01-01&to=2026-01-31`;
  expect((await call('GET', path(t.group.id), { cookie: t.cookie })).body.points.net).toBe(0);
  expect((await call('GET', path(target.id), { cookie: t.cookie })).body.points.net).toBe(7);
  expect((await call('GET', `${path(t.group.id)}&studentId=${sid}`, { cookie: t.cookie })).status).toBe(404);
});

it('некорректные и перевёрнутые даты отклоняются, диапазон ограничен календарным годом', () => {
  for (const pair of [['2026-02-30', '2026-03-01'], ['', '2026-01-01'], ['2026-03-02', '2026-03-01'], ['2025-01-01', '2026-01-02']]) expect(() => trendPeriod(...pair as [string, string])).toThrow();
  expect(trendPeriod('2024-01-01', '2024-12-31')).toEqual({ from: '2024-01-01', to: '2024-12-31' });
});
