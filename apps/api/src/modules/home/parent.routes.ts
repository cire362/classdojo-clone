import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { parentChild } from '../access/index.js';
import { HomeGoalBody, HomePointBody } from './schemas.js';
import { addPoints, createGoal, deleteGoal, deletePoint, homeBoard, updateGoal } from './service.js';

/** Домашние баллы своего ребёнка. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentHomeRoutes = new Hono<AppEnv>()
  .get('/children/:id/home', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await homeBoard(studentId));
  })
  .post('/children/:id/home/goals', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    await createGoal(studentId, parse(HomeGoalBody, await c.req.json().catch(() => null)));
    return c.json({ ok: true }, 201);
  })
  .put('/children/:id/home/goals/:goalId', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    await updateGoal(studentId, c.req.param('goalId'), parse(HomeGoalBody, await c.req.json().catch(() => null)));
    return c.json({ ok: true });
  })
  .delete('/children/:id/home/goals/:goalId', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    await deleteGoal(studentId, c.req.param('goalId'));
    return c.json({ ok: true });
  })
  .post('/children/:id/home/points', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    await addPoints(studentId, parse(HomePointBody, await c.req.json().catch(() => null)));
    return c.json({ ok: true }, 201);
  })
  .delete('/children/:id/home/points/:pointId', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    await deletePoint(studentId, c.req.param('pointId'));
    return c.json({ ok: true });
  });
