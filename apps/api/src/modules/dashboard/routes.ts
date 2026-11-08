import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../../platform/auth.js';
import { dateKey, isDateKey } from '../../platform/dates.js';
import { HttpError, parse } from '../../platform/errors.js';
import { terms } from '../../platform/terms.js';
import { dashboardPdf, dashboardWorkbook } from './files.js';
import { dashboard } from './service.js';

const Query = z.object({
  by: z.enum(['group', 'course', 'department']).default('group'),
  from: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
  to: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
});

/** Отчёт за период; по умолчанию — с начала месяца по сегодня */
async function report(c: Context<AppEnv>) {
  const q = parse(Query, c.req.query());
  const today = new Date();
  const from = q.from ?? dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = q.to ?? dateKey(today);
  if (from > to) throw new HttpError(400, 'Начало периода позже конца');
  return dashboard(c.get('user'), q.by, from, to);
}

/** Название отчёта словами учреждения: «по группам», «по параллелям», «по факультетам» */
function title(by: 'group' | 'course' | 'department') {
  const words = terms();
  if (by === 'course') return `Обзор по ${words.kind === 'SCHOOL' ? 'параллелям' : 'курсам'}`;
  return `Обзор по ${(by === 'department' ? words.department : words.group).many.dat}`;
}

function download(buf: Buffer, type: string, name: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="dashboard"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Панель руководителя: видит вся администрация, сотрудник подразделения — только свои группы */
export const adminDashboardRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/dashboard', async (c) => c.json(await report(c)))
  .get('/dashboard.xlsx', async (c) => {
    const d = await report(c);
    const name = title(d.by);
    const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return download(await dashboardWorkbook(d, name), type, `${name} ${d.from}_${d.to}.xlsx`);
  })
  .get('/dashboard.pdf', async (c) => {
    const d = await report(c);
    const name = title(d.by);
    return download(await dashboardPdf(d, name), 'application/pdf', `${name} ${d.from}_${d.to}.pdf`);
  });
