import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { parentFeedRoutes } from '../modules/feed/index.js';
import { parentMessageRoutes } from '../modules/messages/index.js';
import { parentChild } from '../modules/access/index.js';
import { parentChildRoutes } from '../modules/parents/index.js';
import { parentProfileRoutes } from '../modules/profile/index.js';
import { weeklySummary } from '../services/weekly-summary.js';
import { parentRewardRoutes } from '../modules/rewards/index.js';

/** Кабинет родителя: только просмотр и только своих детей (чужие — 404) */
export const parentRoutes = new Hono<AppEnv>()
  .use(requireRole('PARENT'))
  .route('/', parentChildRoutes)
  .route('/', parentFeedRoutes)
  .route('/', parentMessageRoutes)
  .route('/', parentProfileRoutes)
  .get('/children/:id/weekly-summary', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await weeklySummary(studentId, c.req.query('week')));
  })
  .route('/', parentRewardRoutes);
