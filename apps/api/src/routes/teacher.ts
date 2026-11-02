import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { teacherAccountRoutes } from '../modules/accounts/index.js';
import { attendanceRoutes } from '../modules/attendance/index.js';
import { teacherCalendarRoutes } from '../modules/calendar/index.js';
import { teacherCodeRoutes } from '../modules/codes/index.js';
import { teacherFeedRoutes } from '../modules/feed/index.js';
import { teacherFileRoutes } from '../modules/files/index.js';
import { goalRoutes } from '../modules/goals/index.js';
import { groupRoutes } from '../modules/groups/index.js';
import { teacherHeroRoutes } from '../modules/hero/index.js';
import { teacherMessageRoutes } from '../modules/messages/index.js';
import { teacherParentRoutes } from '../modules/parents/index.js';
import { planRoutes } from '../modules/plan/index.js';
import { pointRoutes } from '../modules/points/index.js';
import { portfolioRoutes } from '../modules/portfolio/index.js';
import { teacherProfileRoutes } from '../modules/profile/index.js';
import { reasonRoutes } from '../modules/reasons/index.js';
import { teacherReportRoutes } from '../modules/reports/index.js';
import { teacherRewardRoutes } from '../modules/rewards/index.js';
import { studentAdminRoutes } from '../modules/students/index.js';
import { teamRoutes } from '../modules/teams/index.js';

/** Кабинет преподавателя: роль проверяется здесь один раз, доступ к группе и ученику — в модулях */
export const teacherRoutes = new Hono<AppEnv>()
  .use(requireRole('TEACHER'))
  .route('/', teacherAccountRoutes)
  .route('/', groupRoutes)
  .route('/', studentAdminRoutes)
  .route('/', teacherCodeRoutes)
  .route('/', teacherProfileRoutes)
  .route('/', teacherHeroRoutes)
  .route('/', portfolioRoutes)
  .route('/', teacherParentRoutes)
  .route('/', teacherMessageRoutes)
  .route('/', teacherRewardRoutes)
  .route('/', teamRoutes)
  .route('/', teacherFeedRoutes)
  .route('/', teacherCalendarRoutes)
  .route('/', reasonRoutes)
  .route('/', goalRoutes)
  .route('/', planRoutes)
  .route('/', pointRoutes)
  .route('/', attendanceRoutes)
  .route('/', teacherFileRoutes)
  .route('/', teacherReportRoutes);
