import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { addReason, archiveReason, manualReasons, ownedReason, reorderReasons, updateReason } from './service.js';

export const ReasonBody = z.object({
  countsForHelpBadge: z.boolean().optional(),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(16),
  value: z
    .number()
    .int()
    .min(-10)
    .max(10)
    .refine((v) => v !== 0, 'Значение не может быть нулём'),
});
const ReasonOrder = z.object({ reasonIds: z.array(z.string().min(1).max(64)).min(1).max(200) });

/** Причины начислений. Роль проверяет сборка routes/teacher.ts */
export const reasonRoutes = new Hono<AppEnv>()
  .get('/groups/:id/reasons', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await manualReasons(group.id));
  })
  .post('/groups/:id/reasons', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const body = parse(ReasonBody, await c.req.json().catch(() => null));
    return c.json(await addReason(group.id, body), 201);
  })
  .put('/groups/:id/reasons/order', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { reasonIds } = parse(ReasonOrder, await c.req.json().catch(() => null));
    await reorderReasons(group.id, reasonIds);
    return c.json({ ok: true });
  })
  .patch('/reasons/:id', async (c) => {
    const reason = await ownedReason(c.get('user').teacherId!, c.req.param('id'));
    const body = parse(ReasonBody, await c.req.json().catch(() => null));
    return c.json(await updateReason(reason.id, body));
  })
  .delete('/reasons/:id', async (c) => {
    const reason = await ownedReason(c.get('user').teacherId!, c.req.param('id'));
    await archiveReason(reason.id);
    return c.json({ ok: true });
  });
