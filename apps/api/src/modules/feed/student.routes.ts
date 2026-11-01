import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { ReactionBody } from './schemas.js';
import { groupFeed, setReaction, studentGroup, type Viewer } from './service.js';

/** Лента своей группы: реагировать можно, комментарии только у взрослых. Роль проверяет routes/student.ts */
export const studentFeedRoutes = new Hono<AppEnv>()
  .get('/feed', async (c) => {
    const user = c.get('user');
    return c.json(await groupFeed(await studentGroup(user.studentId!), { accountId: user.accountId, role: 'student' }));
  })
  .put('/feed/:postId/reaction', async (c) => {
    const user = c.get('user');
    const viewer: Viewer = { accountId: user.accountId, role: 'student' };
    const { kind } = parse(ReactionBody, await c.req.json().catch(() => null));
    return c.json(await setReaction(await studentGroup(user.studentId!), c.req.param('postId'), viewer, kind));
  });
