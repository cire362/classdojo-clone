import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { studentCalendarRoutes } from '../modules/calendar/index.js';
import { studentFeedRoutes } from '../modules/feed/index.js';
import { studentHeroRoutes } from '../modules/hero/index.js';
import { studentHomeRoutes } from '../modules/home/index.js';
import { studentRewardRoutes } from '../modules/rewards/index.js';
import { studentProfileRoutes } from '../modules/profile/index.js';
import { studentNotificationRoutes } from '../modules/notifications/index.js';
import { studentWorkRoutes } from '../modules/works/index.js';
import { studentAssignmentRoutes } from '../modules/assignments/index.js';
import { studentSchoolPointsRoutes } from '../modules/schoolpoints/index.js';
import { studentMessageRoutes } from '../modules/messages/index.js';
import { readerSchoolInboxRoutes } from '../modules/schoolinbox/index.js';
import { studentWorldRoutes } from '../modules/world/index.js';

/** Кабинет ученика: всё строго по studentId из сессии, параметров с чужими id нет */
export const studentRoutes = new Hono<AppEnv>()
  .use(requireRole('STUDENT'))
  .route('/', studentWorldRoutes)
  .route('/', studentProfileRoutes)
  .route('/', studentNotificationRoutes)
  .route('/', studentHeroRoutes)
  .route('/', studentHomeRoutes)
  .route('/', studentRewardRoutes)
  .route('/', studentCalendarRoutes)
  .route('/', studentFeedRoutes)
  .route('/', studentWorkRoutes)
  .route('/', studentAssignmentRoutes)
  .route('/', studentSchoolPointsRoutes)
  .route('/', readerSchoolInboxRoutes)
  .route('/', studentMessageRoutes);
