import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Context } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { env } from '../../platform/env.js';
import { HttpError } from '../../platform/errors.js';
import { teacherGroup, teacherStudent } from '../access/index.js';
import { deleteFile, findFile, storeFile } from './service.js';

/** Запас на служебные части multipart: точный размер файла проверяет сервис */
const limit = bodyLimit({
  maxSize: env.maxFileBytes + 64 * 1024,
  onError: () => {
    throw new HttpError(413, 'Файл слишком большой');
  },
});

async function upload(c: Context<AppEnv>) {
  const { file } = await c.req.parseBody();
  if (!(file instanceof File)) throw new HttpError(400, 'Выберите файл');
  return file;
}

/** Файлы группы и учеников. Роль проверяет сборка routes/teacher.ts */
export const teacherFileRoutes = new Hono<AppEnv>()
  .post('/groups/:id/files', limit, async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'), { writable: true });
    return c.json(await storeFile({ groupId: group.id }, group.id, user.accountId, await upload(c)), 201);
  })
  .post('/students/:id/files', limit, async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    return c.json(await storeFile({ studentId: student.id }, student.groupId, user.accountId, await upload(c)), 201);
  })
  .delete('/files/:id', async (c) => {
    const user = c.get('user');
    const file = await findFile(c.req.param('id'));
    const groupId = file.groupId ?? (await teacherStudent(user, file.studentId!)).groupId;
    await teacherGroup(user, groupId, { writable: true });
    await deleteFile(file.id);
    return c.json({ ok: true });
  });
