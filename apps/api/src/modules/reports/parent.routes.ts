import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parentChild } from '../access/index.js';
import { weeklySummary } from './weekly-summary.service.js';

/** Сводка за неделю для родителя. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentReportRoutes = new Hono<AppEnv>().get('/children/:id/weekly-summary', async (c) => {
  const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
  return c.json(await weeklySummary(studentId, c.req.query('week')));
});
