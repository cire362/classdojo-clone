import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { MonthQuery } from './schemas.js';
import { studentEvents } from './service.js';

/** Календарь своей группы. Роль проверяет routes/student.ts */
export const studentCalendarRoutes = new Hono<AppEnv>().get('/events', async (c) =>
  c.json(await studentEvents(c.get('user').studentId!, parse(MonthQuery, c.req.query()).month)),
);
