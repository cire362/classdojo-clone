import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../../platform/auth.js';
import { HttpError, parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { addComment, deleteComment } from './comments.service.js';
import { CommentBody, PinBody, PostBody, ReactionBody } from './schemas.js';
import { MAX_MEDIA, createPost, deletePost, groupFeed, setPinned, setReaction, type PostMedia, type Viewer } from './service.js';
import { env } from '../../platform/env.js';

/** Видео и до десяти фото, уже уменьшенных браузером, с запасом на служебные части запроса */
const MAX_POST_BYTES = env.maxVideoBytes + 40 * 1024 * 1024;

/** Запись без файлов приходит JSON, с файлами — multipart: поля text и publishAt, файлы photo, video и poster */
async function postInput(c: Context<AppEnv>): Promise<{ text: string; publishAt?: string; media: PostMedia }> {
  if (!c.req.header('content-type')?.startsWith('multipart/form-data')) {
    return { ...parse(PostBody, await c.req.json().catch(() => null)), media: { photos: [] } };
  }
  const body = await c.req.parseBody({ all: true });
  const files = (name: string) => [body[name] ?? []].flat().filter((f): f is File => f instanceof File);
  const photos = files('photo');
  const [video, ...extra] = files('video');
  if (extra.length) throw new HttpError(400, 'В записи может быть одно видео');
  if (photos.length + (video ? 1 : 0) > MAX_MEDIA) throw new HttpError(400, `В записи может быть не больше ${MAX_MEDIA} фото и видео`);
  const field = (name: string) => (typeof body[name] === 'string' ? (body[name] as string) : undefined);
  return {
    ...parse(PostBody, { text: field('text'), publishAt: field('publishAt') || undefined }),
    media: { photos, video, poster: video ? files('poster')[0] : undefined },
  };
}

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
  .post(
    '/groups/:id/feed',
    bodyLimit({
      maxSize: MAX_POST_BYTES,
      onError: () => {
        throw new HttpError(413, 'Файлы слишком большие');
      },
    }),
    async (c) => {
      const { group, viewer } = await access(c, true);
      const { text, publishAt, media } = await postInput(c);
      return c.json(await createPost(group.id, viewer, text, publishAt, media), 201);
    },
  )
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
    const { group, user, viewer } = await access(c);
    const actor = { accountId: user.accountId, name: user.name };
    return c.json(await deleteComment(group.id, c.req.param('postId'), c.req.param('commentId'), viewer, actor));
  })
  .delete('/posts/:id', async (c) => {
    const user = c.get('user');
    await deletePost(user.teacherId!, { accountId: user.accountId, name: user.name }, c.req.param('id'));
    return c.json({ ok: true });
  });
