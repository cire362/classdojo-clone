import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { parentFeedRoutes } from '../modules/feed/index.js';
import { parentMessageRoutes } from '../modules/messages/index.js';
import { parentChildRoutes, parentInviteRoutes } from '../modules/parents/index.js';
import { parentProfileRoutes } from '../modules/profile/index.js';
import { parentReportRoutes } from '../modules/reports/index.js';
import { parentRewardRoutes } from '../modules/rewards/index.js';

/** Кабинет родителя: только просмотр и только своих детей (чужие — 404) */
export const parentRoutes = new Hono<AppEnv>()
  .use(requireRole('PARENT'))
  .route('/', parentChildRoutes)
  .route('/', parentInviteRoutes)
  .route('/', parentFeedRoutes)
  .route('/', parentMessageRoutes)
  .route('/', parentProfileRoutes)
  .route('/', parentReportRoutes)
  .route('/', parentRewardRoutes);
