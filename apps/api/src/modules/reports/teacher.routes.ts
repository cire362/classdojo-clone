import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { dateKey, isDateKey } from '../../platform/dates.js';
import { HttpError, parse } from '../../platform/errors.js';
import { teacherGroup, teacherStudent } from '../access/index.js';
import { reportPdf } from './report-pdf.js';
import { groupStats, statsWorkbook } from './stats.service.js';
import { studentReport } from './student-report.service.js';
import { weeklyStats } from './weekly-stats.service.js';

const id = z.string().min(1).max(64);
const ReportQuery = z.object({ from: z.string().optional(), to: z.string().optional() });
const WeeklyQuery = ReportQuery.extend({ studentId: id.optional(), teamId: id.optional() });

function period(q: Record<string, string | undefined>) {
  const today = new Date();
  const from = q.from && isDateKey(q.from) ? q.from : dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = q.to && isDateKey(q.to) ? q.to : dateKey(today);
  if (from > to) throw new HttpError(400, 'Начало периода позже конца');
  return { from, to };
}

/** Статистика и отчёты. Роль проверяет сборка routes/teacher.ts */
export const teacherReportRoutes = new Hono<AppEnv>()
  .get('/groups/:id/stats', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { from, to } = period(c.req.query());
    return c.json(await groupStats(group.id, from, to));
  })
  .get('/students/:id/report.pdf', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    const query = parse(ReportQuery, c.req.query());
    const report = await studentReport(student.id, user.teacherId!, query);
    const pdf = await reportPdf(report);
    const name = `Отчёт ${student.name.replace(/[\u0000-\u001f/\\]/g, ' ')} ${report.from}_${report.to}.pdf`;
    const encoded = encodeURIComponent(name).replace(/['()*]/g, (s) => `%${s.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="student-report.pdf"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  })
  .get('/groups/:id/stats/weekly', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await weeklyStats(group.id, parse(WeeklyQuery, c.req.query())));
  })
  .get('/groups/:id/stats.xlsx', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { from, to } = period(c.req.query());
    const buf = await statsWorkbook(group.id, group.name, from, to);
    const filename = `Статистика ${group.name} ${from}_${to}.xlsx`;
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stats.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  });
