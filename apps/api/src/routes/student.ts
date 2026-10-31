import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { parse } from '../platform/errors.js';
import { studentFeedRoutes } from '../modules/feed/index.js';
import { studentHeroRoutes } from '../modules/hero/index.js';
import { studentRewardRoutes } from '../modules/rewards/index.js';
import { studentProfile } from '../services/profile.js';
import { readStudentNotifications, studentNotifications } from '../services/studentNotifications.js';

/** Кабинет ученика: всё строго по studentId из сессии, параметров с чужими id нет */
export const studentRoutes = new Hono<AppEnv>()
  .use(requireRole('STUDENT'))
  .get('/profile', async (c) => c.json(await studentProfile(c.get('user').studentId!)))
  .get('/notifications', async (c) => {
    const query = parse(z.object({ before: z.string().max(200).optional(), through: z.string().datetime().optional() }), c.req.query());
    return c.json(await studentNotifications(c.get('user').studentId!, query));
  })
  .post('/notifications/read', async (c) => {
    const body = parse(z.object({ groupId: z.string().min(1).max(100), through: z.string().datetime() }), await c.req.json().catch(() => null));
    await readStudentNotifications(c.get('user').studentId!, body.groupId, body.through);
    return c.json({ ok: true });
  })
  .route('/', studentHeroRoutes)
  .route('/', studentRewardRoutes)
  .route('/', studentFeedRoutes);
