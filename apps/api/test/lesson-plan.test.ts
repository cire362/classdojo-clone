import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const path = (t: Teacher) => `/api/teacher/groups/${t.group.id}`;
const save = (t: Teacher, steps: unknown, cookie = t.cookie) => call('PUT', `${path(t)}/plan`, { cookie, body: { steps } });
const step = (t: Teacher, current: unknown, cookie = t.cookie) => call('PUT', `${path(t)}/plan/current`, { cookie, body: { current } });
const inGroup = async (t: Teacher) => (await call('GET', path(t), { cookie: t.cookie })).body.plan;

it('план приходит вместе с группой, текущий шаг сохраняется', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect(await inGroup(t)).toEqual({ steps: [], current: 0 });
  expect((await save(t, ['  Разминка ', 'Новая тема', 'Итоги'])).body).toEqual({ steps: ['Разминка', 'Новая тема', 'Итоги'], current: 0 });
  expect((await step(t, 2)).body.current).toBe(2);
  expect(await inGroup(t)).toEqual({ steps: ['Разминка', 'Новая тема', 'Итоги'], current: 2 });
});

it('правка плана оставляет текущим тот же шаг, а если его нет — ближайший', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  await save(t, ['Разминка', 'Новая тема', 'Итоги']);
  await step(t, 1);
  expect((await save(t, ['Повторение', 'Разминка', 'Новая тема', 'Итоги'])).body.current).toBe(2);
  expect((await save(t, ['Разминка', 'Другая тема', 'Итоги', 'Рефлексия'])).body.current).toBe(2);
  await step(t, 3);
  expect((await save(t, ['Только один шаг'])).body.current).toBe(0);
});

it('пустой список удаляет план; шаг вне плана и шаг без плана отклоняются', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await step(t, 0)).status).toBe(409);
  await save(t, ['Разминка', 'Итоги']);
  expect((await step(t, 2)).status).toBe(409);
  expect((await step(t, -1)).status).toBe(400);
  expect((await step(t, 1.5)).status).toBe(400);
  expect((await save(t, [])).body).toEqual({ steps: [], current: 0 });
  expect(await prisma.lessonPlan.count({ where: { groupId: t.group.id } })).toBe(0);
});

it('границы текста: до 20 шагов по 200 символов, пустой шаг не принимается', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await save(t, Array.from({ length: 20 }, (_, i) => `Шаг ${i}`))).status).toBe(200);
  expect((await save(t, Array.from({ length: 21 }, (_, i) => `Шаг ${i}`))).status).toBe(400);
  expect((await save(t, ['я'.repeat(200)])).status).toBe(200);
  expect((await save(t, ['я'.repeat(201)])).status).toBe(400);
  expect((await save(t, ['   '])).status).toBe(400);
  expect((await save(t, 'Разминка')).status).toBe(400);
});

it('чужая группа — 404, архив — 409, удаление группы убирает план', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Петя Смирнов']);
  await save(t, ['Разминка']);
  expect((await save(t, ['Чужой план'], other.cookie)).status).toBe(404);
  expect((await step(t, 0, other.cookie)).status).toBe(404);
  await call('POST', `${path(t)}/archive`, { cookie: t.cookie });
  expect((await save(t, ['Новый план'])).status).toBe(409);
  expect((await step(t, 0)).status).toBe(409);
  expect(await inGroup(t)).toEqual({ steps: ['Разминка'], current: 0 });
  await call('DELETE', path(t), { cookie: t.cookie });
  expect(await prisma.lessonPlan.count({ where: { groupId: t.group.id } })).toBe(0);
});
