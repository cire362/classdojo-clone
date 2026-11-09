import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../../platform/auth.js';
import { env } from '../../platform/env.js';
import { HttpError, parse } from '../../platform/errors.js';
import { WorkBody } from './schemas.js';
import { studentRecipients } from './recipients.service.js';
import { MAX_WORK_FILES, deleteOwnWork, ownWorks, submitWork } from './service.js';

/** Все файлы предельного размера и запас на служебные части запроса: точные пределы проверяет сервис */
const limit = bodyLimit({
  maxSize: MAX_WORK_FILES * env.maxFileBytes + 1024 * 1024,
  onError: () => {
    throw new HttpError(413, 'Файлы слишком большие');
  },
});

/** Свои работы ученика. Роль проверяет routes/student.ts, чужих id в адресах нет */
export const studentWorkRoutes = new Hono<AppEnv>()
  .get('/works', async (c) => c.json(await ownWorks(c.get('user').studentId!)))
  /** Кому можно отправить работу: куратору или преподавателю дисциплины группы */
  .get('/works/recipients', async (c) => c.json(await studentRecipients(c.get('user').studentId!)))
  /** multipart: поля title, text и subjectId (кому; пусто — куратору), файлы file */
  .post('/works', limit, async (c) => {
    const user = c.get('user');
    const body = await c.req.parseBody({ all: true }).catch(() => {
      throw new HttpError(400, 'Работа отправляется формой с файлами');
    });
    const field = (name: string) => (typeof body[name] === 'string' ? (body[name] as string) : undefined);
    const files = [body.file ?? []].flat().filter((f): f is File => f instanceof File);
    const { title, text, subjectId } = parse(WorkBody, { title: field('title'), text: field('text'), subjectId: field('subjectId') });
    return c.json(await submitWork(user.studentId!, user.accountId, { title, text, files, subjectId: subjectId || null }), 201);
  })
  .delete('/works/:id', async (c) => c.json(await deleteOwnWork(c.get('user').studentId!, c.req.param('id'))));
