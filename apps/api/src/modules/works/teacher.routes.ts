import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { DecisionBody } from './schemas.js';
import { decideWork, deleteWork, groupWorks } from './service.js';

/** Проверка работ любым преподавателем группы, и в архивной группе тоже. Роль проверяет routes/teacher.ts */
export const teacherWorkRoutes = new Hono<AppEnv>()
  .get('/groups/:id/works', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await groupWorks(group.id, c.get('user').teacherId!));
  })
  .put('/groups/:id/works/:workId', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'));
    const decision = parse(DecisionBody, await c.req.json().catch(() => null));
    return c.json(await decideWork(group.id, { id: user.teacherId!, accountId: user.accountId }, c.req.param('workId'), decision));
  })
  .delete('/works/:id', async (c) => c.json(await deleteWork(c.get('user').teacherId!, c.req.param('id'))));
