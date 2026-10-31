import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parentChildren } from './service.js';

/** Дети родителя. Роль проверяет routes/parent.ts */
export const parentChildRoutes = new Hono<AppEnv>().get('/children', async (c) => {
  const user = c.get('user');
  return c.json(await parentChildren(user.parentId!, user.accountId));
});
