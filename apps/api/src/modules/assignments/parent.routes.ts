import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parentChild } from '../access/index.js';
import { parentAssignments } from './answers.service.js';

/** Задания ребёнка. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentAssignmentRoutes = new Hono<AppEnv>().get('/children/:id/assignments', async (c) => {
  const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
  return c.json(await parentAssignments(studentId));
});
