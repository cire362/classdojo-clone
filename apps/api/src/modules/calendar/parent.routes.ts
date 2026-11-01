import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { parentChild } from '../access/index.js';
import { MonthQuery } from './schemas.js';
import { studentEvents } from './service.js';

/** Календарь группы ребёнка. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentCalendarRoutes = new Hono<AppEnv>().get('/children/:id/events', async (c) => {
  const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
  return c.json(await studentEvents(studentId, parse(MonthQuery, c.req.query()).month));
});
