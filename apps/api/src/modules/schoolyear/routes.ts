import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { schoolYearPreview, startSchoolYear } from './service.js';

const StartBody = z.object({
  graduateIds: z.array(z.string().min(1).max(64)).max(1000),
  rename: z.boolean(),
  force: z.boolean().default(false),
});
const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');

/** Переход на новый учебный год: смотрит вся администрация учреждения, проводят руководитель и заместитель */
export const adminSchoolYearRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/school-year', MANAGERS, async (c) => c.json(await schoolYearPreview(c.get('user').schoolId!)))
  .post('/school-year', MANAGERS, async (c) => {
    const body = parse(StartBody, await c.req.json().catch(() => null));
    return c.json(await startSchoolYear(c.get('user').schoolId!, body));
  });
