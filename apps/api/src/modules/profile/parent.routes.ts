import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parentChild } from '../access/index.js';
import { studentProfile } from './service.js';

/** Профиль ребёнка для родителя. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentProfileRoutes = new Hono<AppEnv>().get('/children/:id/profile', async (c) => {
  const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
  return c.json(await studentProfile(studentId));
});
