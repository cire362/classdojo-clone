import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../../platform/auth.js';
import { HttpError, parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { addComment, deleteComment } from './comments.service.js';
import { CommentBody, PinBody, PostBody, ReactionBody } from './schemas.js';
import { MAX_PHOTOS, createPost, deletePost, groupFeed, setPinned, setReaction, type Viewer } from './service.js';

/** Фото уже уменьшены браузером; предел с запасом на случай, если запрос пришёл не из браузера */
const MAX_POST_BYTES = 40 * 1024 * 1024;

/** Запись без фото приходит JSON, с фото — multipart: поля text и publishAt и файлы photo */
async function postInput(c: Context<AppEnv>) {
  if (!c.req.header('content-type')?.startsWith('multipart/form-data')) {
    return { ...parse(PostBody, await c.req.json().catch(() => null)), photos: [] as File[] };
  }
  const body = await c.req.parseBody({ all: true });
  const photos = [body.photo ?? []].flat().filter((p): p is File => p instanceof File);
  if (photos.length > MAX_PHOTOS) throw new HttpError(400, `В записи может быть не больше ${MAX_PHOTOS} фото`);
  const field = (name: string) => (typeof body[name] === 'string' ? (body[name] as string) : undefined);
  return { ...parse(PostBody, { text: field('text'), publishAt: field('publishAt') || undefined }), photos };
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
        throw new HttpError(413, 'Фото слишком большие');
      },
    }),
    async (c) => {
      const { group, viewer } = await access(c, true);
      const { text, publishAt, photos } = await postInput(c);
      return c.json(await createPost(group.id, viewer, text, publishAt, photos), 201);
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
    const { group, viewer } = await access(c);
    return c.json(await deleteComment(group.id, c.req.param('postId'), c.req.param('commentId'), viewer));
  })
  .delete('/posts/:id', async (c) => {
    await deletePost(c.get('user').teacherId!, c.req.param('id'));
    return c.json({ ok: true });
  });
