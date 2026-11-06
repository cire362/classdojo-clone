import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { parentCalendarRoutes } from '../modules/calendar/index.js';
import { parentAssignmentRoutes } from '../modules/assignments/index.js';
import { parentExportRoutes } from '../modules/exports/index.js';
import { parentFeedRoutes } from '../modules/feed/index.js';
import { parentHomeRoutes } from '../modules/home/index.js';
import { parentMessageRoutes } from '../modules/messages/index.js';
import { parentChildRoutes, parentInviteRoutes } from '../modules/parents/index.js';
import { parentProfileRoutes } from '../modules/profile/index.js';
import { parentReportRoutes } from '../modules/reports/index.js';
import { parentRewardRoutes } from '../modules/rewards/index.js';

/** Кабинет родителя: только свои дети (чужие — 404). Школьные данные только для просмотра, домашние баллы ведёт сам родитель */
export const parentRoutes = new Hono<AppEnv>()
  .use(requireRole('PARENT'))
  .route('/', parentChildRoutes)
  .route('/', parentInviteRoutes)
  .route('/', parentFeedRoutes)
  .route('/', parentCalendarRoutes)
  .route('/', parentHomeRoutes)
  .route('/', parentMessageRoutes)
  .route('/', parentProfileRoutes)
  .route('/', parentReportRoutes)
  .route('/', parentRewardRoutes)
  .route('/', parentExportRoutes)
  .route('/', parentAssignmentRoutes);
