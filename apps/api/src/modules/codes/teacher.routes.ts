import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { activeClassCode, createClassCode, issueLoginCards, removeClassCode } from './service.js';

const CardsBody = z.object({ studentIds: z.array(z.string().min(1).max(64)).min(1).max(200).optional() });

/** QR-карточки и код класса. Роль проверяет сборка routes/teacher.ts */
export const teacherCodeRoutes = new Hono<AppEnv>()
  .post('/groups/:id/login-cards', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { studentIds } = parse(CardsBody, await c.req.json().catch(() => ({})));
    return c.json({ cards: await issueLoginCards(group.id, studentIds) }, 201);
  })
  .get('/groups/:id/class-code', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await activeClassCode(group.id));
  })
  .post('/groups/:id/class-code', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    return c.json(await createClassCode(group.id), 201);
  })
  .delete('/groups/:id/class-code', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    await removeClassCode(group.id);
    return c.json({ ok: true });
  });
