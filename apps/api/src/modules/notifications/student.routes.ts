import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { readStudentNotifications, studentNotifications } from './student.service.js';

const NotificationsQuery = z.object({ before: z.string().max(200).optional(), through: z.string().datetime().optional() });
const ReadBody = z.object({ groupId: z.string().min(1).max(100), through: z.string().datetime() });

/** Уведомления ученика. Роль проверяет routes/student.ts */
export const studentNotificationRoutes = new Hono<AppEnv>()
  .get('/notifications', async (c) => {
    const query = parse(NotificationsQuery, c.req.query());
    return c.json(await studentNotifications(c.get('user').studentId!, query));
  })
  .post('/notifications/read', async (c) => {
    const body = parse(ReadBody, await c.req.json().catch(() => null));
    await readStudentNotifications(c.get('user').studentId!, body.groupId, body.through);
    return c.json({ ok: true });
  });
