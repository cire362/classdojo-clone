import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { markNewsSeen, studentNews } from './news.service.js';
import { saveHero } from './service.js';

const SeenBody = z.object({ kind: z.enum(['level', 'parts']) });

/** Свой герой и новости ученика. Роль проверяет routes/student.ts */
export const studentHeroRoutes = new Hono<AppEnv>()
  .put('/hero', async (c) => c.json(await saveHero(c.get('user').studentId!, await c.req.json().catch(() => null))))
  .get('/news', async (c) => c.json(await studentNews(c.get('user').studentId!)))
  .post('/news/seen', async (c) => {
    const { kind } = parse(SeenBody, await c.req.json().catch(() => null));
    return c.json(await markNewsSeen(c.get('user').studentId!, kind));
  });
