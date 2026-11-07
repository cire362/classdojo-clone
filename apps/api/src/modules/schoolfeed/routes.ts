import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { env } from '../../platform/env.js';
import { HttpError, parse } from '../../platform/errors.js';
import { MAX_SCHOOL_POST_FILES, adminSchoolFeed, createSchoolPost, deleteSchoolPost, readSchoolFeed } from './service.js';

const PostBody = z.object({
  text: z.string().trim().max(5000, 'Не больше 5000 символов').default(''),
  important: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

/** Все файлы предельного размера и запас на служебные части запроса: точные пределы проверяет сервис */
const limit = bodyLimit({
  maxSize: MAX_SCHOOL_POST_FILES * env.maxFileBytes + 1024 * 1024,
  onError: () => {
    throw new HttpError(413, 'Файлы слишком большие');
  },
});

/** Чтение ленты: преподаватели, родители и студенты колледжа и вуза. Школьник ленту школы не видит. Вход проверяет app.ts */
export const schoolFeedRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const user = c.get('user');
  if (user.role === 'STUDENT' && (user.institution ?? 'SCHOOL') === 'SCHOOL') throw new HttpError(403, 'Недостаточно прав');
  return c.json(await readSchoolFeed(c.get('user')));
});

/** Лента в панели школы: видит вся администрация, пишут и удаляют директор и завуч */
export const adminSchoolFeedRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/school-feed', async (c) => c.json(await adminSchoolFeed(c.get('user').schoolId!)))
  /** multipart: text, important ('true'), file (несколько) */
  .post('/school-feed', requireSchoolRole('DIRECTOR', 'DEPUTY'), limit, async (c) => {
    const body = await c.req.parseBody({ all: true }).catch(() => {
      throw new HttpError(400, 'Запись отправляется формой');
    });
    const field = (name: string) => (typeof body[name] === 'string' ? (body[name] as string) : undefined);
    const input = parse(PostBody, { text: field('text'), important: field('important') });
    const files = [body.file ?? []].flat().filter((f): f is File => f instanceof File);
    return c.json(await createSchoolPost(c.get('user'), input, files), 201);
  })
  .delete('/school-feed/:id', requireSchoolRole('DIRECTOR', 'DEPUTY'), async (c) => {
    return c.json(await deleteSchoolPost(c.get('user').schoolId!, c.req.param('id')));
  });
