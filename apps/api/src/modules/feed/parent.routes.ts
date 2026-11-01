import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { parentChild } from '../access/index.js';
import { addComment, deleteComment, parentLabel } from './comments.service.js';
import { CommentBody, ReactionBody } from './schemas.js';
import { groupFeed, setReaction, studentGroup, type Viewer } from './service.js';

/** Чужой ребёнок — 404: родитель видит ленту только через своего */
async function access(c: Context<AppEnv>) {
  const user = c.get('user');
  const studentId = await parentChild(user.parentId!, c.req.param('id')!);
  const viewer: Viewer = { accountId: user.accountId, role: 'parent' };
  return { studentId, groupId: await studentGroup(studentId), viewer };
}

/** Лента группы ребёнка. Роль проверяет routes/parent.ts */
export const parentFeedRoutes = new Hono<AppEnv>()
  .get('/children/:id/feed', async (c) => {
    const { groupId, viewer } = await access(c);
    return c.json(await groupFeed(groupId, viewer));
  })
  .put('/children/:id/feed/:postId/reaction', async (c) => {
    const { groupId, viewer } = await access(c);
    const { kind } = parse(ReactionBody, await c.req.json().catch(() => null));
    return c.json(await setReaction(groupId, c.req.param('postId'), viewer, kind));
  })
  .post('/children/:id/feed/:postId/comments', async (c) => {
    const { studentId, groupId, viewer } = await access(c);
    const { text } = parse(CommentBody, await c.req.json().catch(() => null));
    return c.json(await addComment(groupId, c.req.param('postId'), viewer, await parentLabel(studentId), text), 201);
  })
  .delete('/children/:id/feed/:postId/comments/:commentId', async (c) => {
    const { groupId, viewer } = await access(c);
    return c.json(await deleteComment(groupId, c.req.param('postId'), c.req.param('commentId'), viewer));
  });
