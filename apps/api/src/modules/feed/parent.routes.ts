import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { parentChild } from '../access/index.js';
import { ReportBody, reportContent } from '../moderation/index.js';
import { addComment, deleteComment, parentLabel } from './comments.service.js';
import { CommentBody, ReactionBody } from './schemas.js';
import { feedPost, groupFeed, setReaction, studentGroup, type Viewer } from './service.js';

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
    const { studentId, groupId, viewer } = await access(c);
    const actor = { accountId: viewer.accountId, name: await parentLabel(studentId) };
    return c.json(await deleteComment(groupId, c.req.param('postId'), c.req.param('commentId'), viewer, actor));
  })
  /**
   * Жалоба на запись или, с commentId, на комментарий. Преподаватели увидят её в очереди группы.
   * post: запись глазами родителя или null, если жалоба её скрыла
   */
  .post('/children/:id/feed/:postId/reports', async (c) => {
    const { studentId, groupId, viewer } = await access(c);
    const { reason, note, commentId } = parse(ReportBody, await c.req.json().catch(() => null));
    const reporter = { accountId: viewer.accountId, name: await parentLabel(studentId) };
    await reportContent(groupId, reporter, { postId: c.req.param('postId'), commentId }, reason, note);
    const post = await feedPost(groupId, c.req.param('postId'), viewer).catch(() => null);
    return c.json({ post }, 201);
  });
