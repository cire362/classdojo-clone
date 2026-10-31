import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parentChild } from '../../services/parents.js';
import { studentFeed } from './service.js';

/** Лента группы ребёнка. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentFeedRoutes = new Hono<AppEnv>().get('/children/:id/feed', async (c) => {
  const user = c.get('user');
  const studentId = await parentChild(user.parentId!, c.req.param('id'));
  return c.json(await studentFeed(studentId, user.accountId));
});
