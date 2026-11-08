import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../../platform/auth.js';
import { dateKey, isDateKey } from '../../platform/dates.js';
import { HttpError, parse } from '../../platform/errors.js';
import { networkOverview, networkWorkbook } from './service.js';

const Query = z.object({
  from: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
  to: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
});

/** Сводка за период; по умолчанию — с начала месяца по сегодня */
function overview(c: Context<AppEnv>) {
  const q = parse(Query, c.req.query());
  const today = new Date();
  const from = q.from ?? dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = q.to ?? dateKey(today);
  if (from > to) throw new HttpError(400, 'Начало периода позже конца');
  return networkOverview(c.get('user').networkId!, from, to);
}

/** Кабинет руководителя сети учреждений */
export const networkRoutes = new Hono<AppEnv>()
  .use(requireRole('NETWORK'))
  .get('/overview', async (c) => c.json(await overview(c)))
  .get('/overview.xlsx', async (c) => {
    const o = await overview(c);
    const name = `${o.name} ${o.from}_${o.to}.xlsx`.replace(/[\u0000-\u001f/\\]/g, ' ');
    return new Response(new Uint8Array(await networkWorkbook(o)), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="network.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
