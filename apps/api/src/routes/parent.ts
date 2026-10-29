import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../auth.js';
import { parentChild, parentChildren } from '../services/parents.js';
import { studentProfile } from '../services/profile.js';

/** Кабинет родителя: только просмотр и только своих детей (чужие — 404) */
export const parentRoutes = new Hono<AppEnv>()
  .use(requireRole('PARENT'))
  .get('/children', async (c) => c.json(await parentChildren(c.get('user').parentId!)))
  .get('/children/:id/profile', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await studentProfile(studentId));
  });
