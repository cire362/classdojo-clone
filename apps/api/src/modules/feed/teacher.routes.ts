import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { addComment, deleteComment } from './comments.service.js';
import { CommentBody, PinBody, PostBody, ReactionBody } from './schemas.js';
import { createPost, deletePost, groupFeed, setPinned, setReaction, type Viewer } from './service.js';

/** Группа и зритель запроса; изменения закрыты в архивной группе */
async function access(c: Context<AppEnv>, writable = false) {
  const user = c.get('user');
  const group = await teacherGroup(user, c.req.param('id')!, { writable });
  const viewer: Viewer = { accountId: user.accountId, role: 'teacher', teacherId: user.teacherId, isOwner: group.isOwner };
  return { group, user, viewer };
}

/** Лента группы для преподавателя. Роль проверяет сборка routes/teacher.ts */
export const teacherFeedRoutes = new Hono<AppEnv>()
  .get('/groups/:id/feed', async (c) => {
    const { group, viewer } = await access(c);
    return c.json(await groupFeed(group.id, viewer));
  })
  .post('/groups/:id/feed', async (c) => {
    const { group, viewer } = await access(c, true);
    const { text, publishAt } = parse(PostBody, await c.req.json().catch(() => null));
    return c.json(await createPost(group.id, viewer, text, publishAt), 201);
  })
  .put('/groups/:id/feed/:postId/pin', async (c) => {
    const { group, viewer } = await access(c, true);
    const { pinned } = parse(PinBody, await c.req.json().catch(() => null));
    return c.json(await setPinned(group.id, c.req.param('postId'), viewer, pinned));
  })
  .put('/groups/:id/feed/:postId/reaction', async (c) => {
    const { group, viewer } = await access(c, true);
    const { kind } = parse(ReactionBody, await c.req.json().catch(() => null));
    return c.json(await setReaction(group.id, c.req.param('postId'), viewer, kind));
  })
  .post('/groups/:id/feed/:postId/comments', async (c) => {
    const { group, user, viewer } = await access(c, true);
    const { text } = parse(CommentBody, await c.req.json().catch(() => null));
    return c.json(await addComment(group.id, c.req.param('postId'), viewer, user.name, text), 201);
  })
  .delete('/groups/:id/feed/:postId/comments/:commentId', async (c) => {
    const { group, viewer } = await access(c);
    return c.json(await deleteComment(group.id, c.req.param('postId'), c.req.param('commentId'), viewer));
  })
  .delete('/posts/:id', async (c) => {
    await deletePost(c.get('user').teacherId!, c.req.param('id'));
    return c.json({ ok: true });
  });
