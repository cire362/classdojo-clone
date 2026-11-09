import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { getWorld, solveWorld } from './service.js';

const Solution = z.object({ levelId: z.string().max(32), moves: z.array(z.enum(['up', 'right', 'down', 'left'])).max(30) });

/** Сад маяков ученика. Роль проверяет сборка routes/student.ts */
export const studentWorldRoutes = new Hono<AppEnv>()
  .get('/world', async (c) => c.json(await getWorld(c.get('user').studentId!)))
  .post('/world/solve', async (c) => {
    const body = parse(Solution, await c.req.json().catch(() => null));
    return c.json(await solveWorld(c.get('user').studentId!, body.levelId, body.moves));
  });
