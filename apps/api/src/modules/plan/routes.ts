import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { savePlanSteps, setPlanStep } from './service.js';

const PlanBody = z.object({ steps: z.array(z.string().trim().min(1, 'Шаг не может быть пустым').max(200)).max(20) });
const CurrentBody = z.object({ current: z.number().int().min(0).max(19) });

/** План урока. Сам план приходит вместе с группой. Роль проверяет сборка routes/teacher.ts */
export const planRoutes = new Hono<AppEnv>()
  .put('/groups/:id/plan', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { steps } = parse(PlanBody, await c.req.json().catch(() => null));
    return c.json(await savePlanSteps(group.id, steps));
  })
  .put('/groups/:id/plan/current', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { current } = parse(CurrentBody, await c.req.json().catch(() => null));
    return c.json(await setPlanStep(group.id, current));
  });
