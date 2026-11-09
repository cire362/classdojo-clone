import { expect, it } from 'vitest';
import { GARDEN_LEVELS, DIRECTIONS, walkGarden, type Direction } from '@heroes/shared/world';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

const first: Direction[] = ['right', 'right', 'right', 'right', 'down', 'down', 'down', 'down'];
const solve = (cookie: string, levelId: string, moves: Direction[]) =>
  call('POST', '/api/student/world/solve', { cookie, body: { levelId, moves } });

it('все шесть мест решаемы в пределах шагов; нельзя пройти сквозь камень или за край', () => {
  for (const level of GARDEN_LEVELS) {
    const queue: Direction[][] = [[]];
    const seen = new Set<string>();
    let solution: Direction[] | undefined;
    while (queue.length) {
      const moves = queue.shift()!;
      const result = walkGarden(level, moves);
      if (!result.valid) continue;
      if (result.won) { solution = moves; break; }
      const key = `${result.position}:${result.lit.sort((a, b) => a - b)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (moves.length < level.maxSteps) {
        for (const direction of Object.keys(DIRECTIONS) as Direction[]) queue.push([...moves, direction]);
      }
    }
    expect(solution, level.title).toBeDefined();
  }
  expect(walkGarden(GARDEN_LEVELS[0], ['left']).valid).toBe(false);
  expect(walkGarden(GARDEN_LEVELS[0], ['right', 'down']).valid).toBe(false);
});

it('сад открыт сразу и в любой момент: без включения, окна по времени и запуска сессии', async () => {
  const t = await setupTeacher(['Мира']);
  const cookie = await t.studentCookie(0);
  expect((await call('GET', '/api/student/world', { cookie })).body).toMatchObject({ available: true, reason: null, completed: [] });
  expect((await solve(cookie, 'landing', first)).body.completed).toEqual(['landing']);
  // Повтор решения ничего не дублирует, учебные баллы не меняются
  expect((await solve(cookie, 'landing', first)).body.completed).toEqual(['landing']);
  expect(await prisma.pointEvent.count({ where: { studentId: t.students[0].id } })).toBe(0);
});

it('места по порядку, неверный маршрут отклоняется сервером', async () => {
  const t = await setupTeacher(['Мира']);
  const cookie = await t.studentCookie(0);
  expect((await solve(cookie, 'beacon', first)).status).toBe(409);
  expect((await solve(cookie, 'landing', ['left'])).status).toBe(422);
  expect((await solve(cookie, 'nowhere', first)).status).toBe(404);
  // Две вкладки одновременно: место записывается один раз
  const both = await Promise.all([solve(cookie, 'landing', first), solve(cookie, 'landing', first)]);
  expect(both.map((r) => r.status)).toEqual([200, 200]);
  expect((await prisma.worldProgress.findUniqueOrThrow({ where: { studentId: t.students[0].id } })).completed).toEqual(['landing']);
});

it('сад только у ученика; выключенные герои и архив закрывают его, прогресс переходит с учеником', async () => {
  const t = await setupTeacher(['Мира']);
  const cookie = await t.studentCookie(0);
  expect((await call('GET', '/api/student/world')).status).toBe(401);
  expect((await call('GET', '/api/student/world', { cookie: t.cookie })).status).toBe(403);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const parent = await login(issued.login, issued.password);
  expect((await solve(parent, 'landing', first)).status).toBe(403);
  await solve(cookie, 'landing', first);
  await prisma.group.update({ where: { id: t.group.id }, data: { heroes: false } });
  expect((await call('GET', '/api/student/world', { cookie })).status).toBe(403);
  await prisma.group.update({ where: { id: t.group.id }, data: { heroes: true, archivedAt: new Date() } });
  const closed = (await call('GET', '/api/student/world', { cookie })).body;
  expect(closed).toMatchObject({ available: false, reason: 'Группа в архиве. Сад закрыт.' });
  expect((await solve(cookie, 'stream', [])).status).toBe(403);
  const other = await setupTeacher([]);
  await prisma.student.update({ where: { id: t.students[0].id }, data: { groupId: other.group.id } });
  expect((await call('GET', '/api/student/world', { cookie })).body).toMatchObject({ available: true, completed: ['landing'] });
});
