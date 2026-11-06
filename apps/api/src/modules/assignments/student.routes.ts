import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../../platform/auth.js';
import { env } from '../../platform/env.js';
import { HttpError, parse } from '../../platform/errors.js';
import { MAX_WORK_FILES } from '../works/index.js';
import { studentAssignments, submitAnswer } from './answers.service.js';
import { AnswerBody } from './schemas.js';

const limit = bodyLimit({
  maxSize: MAX_WORK_FILES * env.maxFileBytes + 1024 * 1024,
  onError: () => {
    throw new HttpError(413, 'Файлы слишком большие');
  },
});

/** Задания ученика и ответы на них. Роль проверяет routes/student.ts, чужих заданий нет в выдаче */
export const studentAssignmentRoutes = new Hono<AppEnv>()
  .get('/assignments', async (c) => c.json(await studentAssignments(c.get('user').studentId!)))
  /** multipart: поле text, файлы file */
  .post('/assignments/:id/answers', limit, async (c) => {
    const user = c.get('user');
    const body = await c.req.parseBody({ all: true }).catch(() => {
      throw new HttpError(400, 'Ответ отправляется формой с файлами');
    });
    const { text } = parse(AnswerBody, { text: typeof body.text === 'string' ? body.text : undefined });
    const files = [body.file ?? []].flat().filter((f): f is File => f instanceof File);
    return c.json(await submitAnswer(user.studentId!, user.accountId, c.req.param('id'), { text, files }), 201);
  });
