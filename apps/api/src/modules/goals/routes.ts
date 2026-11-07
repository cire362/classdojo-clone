import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { classGoal, removeClassGoal, saveClassGoal } from './service.js';

const ClassGoalBody = z.object({
  title: z.string().trim().min(1, 'Напишите цель').max(100),
  target: z.number().int().min(1, 'Нужно хотя бы 1 балл').max(1_000_000),
});

/** Общая цель класса. Роль проверяет сборка routes/teacher.ts */
export const goalRoutes = new Hono<AppEnv>()
  .get('/groups/:id/goal', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await classGoal(group.id));
  })
  .put('/groups/:id/goal', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const body = parse(ClassGoalBody, await c.req.json().catch(() => null));
    return c.json(await saveClassGoal(group.id, body));
  })
  .post('/groups/:id/goal/restart', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const body = parse(ClassGoalBody, await c.req.json().catch(() => null));
    return c.json(await saveClassGoal(group.id, body, true));
  })
  .delete('/groups/:id/goal', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    await removeClassGoal(group.id);
    return c.json({ ok: true });
  });
