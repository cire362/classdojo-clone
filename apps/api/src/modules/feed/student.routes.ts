import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { studentFeed } from './service.js';

/** Лента своей группы. Роль проверяет routes/student.ts */
export const studentFeedRoutes = new Hono<AppEnv>().get('/feed', async (c) => {
  const user = c.get('user');
  return c.json(await studentFeed(user.studentId!, user.accountId));
});
