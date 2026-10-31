import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parentChild } from '../access/index.js';
import { parentRewards } from './service.js';

/** Награды ребёнка для родителя. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentRewardRoutes = new Hono<AppEnv>().get('/children/:id/rewards', async (c) => {
  const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
  return c.json(await parentRewards(studentId, c.req.query('before')));
});
