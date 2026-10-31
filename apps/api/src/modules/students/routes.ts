import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../../platform/auth.js';
import { HttpError, parse } from '../../platform/errors.js';
import { teacherGroup, teacherStudent } from '../access/index.js';
import { MAX_IMPORT_BYTES } from './import.js';
import { MoveBody, ResetMany, StudentPatch, StudentsCreate } from './schemas.js';
import {
  addStudents,
  deleteStudent,
  importPreview,
  moveStudent,
  renameStudent,
  resetGroupPasswords,
  resetStudentPassword,
} from './service.js';

/** Ученики группы. Роль проверяет сборка routes/teacher.ts */
export const studentAdminRoutes = new Hono<AppEnv>()
  .post('/groups/:id/students', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { names } = parse(StudentsCreate, await c.req.json().catch(() => null));
    return c.json({ credentials: await addStudents(group.id, names) }, 201);
  })
  .post(
    '/groups/:id/students/import-preview',
    bodyLimit({
      maxSize: MAX_IMPORT_BYTES + 64 * 1024,
      onError: () => {
        throw new HttpError(413, 'Файл слишком большой (больше 2 МБ)');
      },
    }),
    async (c) => {
      const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!(file instanceof File)) throw new HttpError(400, 'Загрузите файл');
      return c.json(await importPreview(group.id, file));
    },
  )
  .post('/groups/:id/reset-passwords', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { studentIds } = parse(ResetMany, await c.req.json().catch(() => ({})));
    return c.json({ credentials: await resetGroupPasswords(group.id, studentIds) });
  })
  .patch('/students/:id', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    const { name } = parse(StudentPatch, await c.req.json().catch(() => null));
    return c.json(await renameStudent(student.id, name));
  })
  .delete('/students/:id', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    await deleteStudent(student.id);
    return c.json({ ok: true });
  })
  .post('/students/:id/move', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    const { groupId } = parse(MoveBody, await c.req.json().catch(() => null));
    const target = await teacherGroup(c.get('user'), groupId, { writable: true });
    return c.json(await moveStudent(student, target));
  })
  .post('/students/:id/reset-password', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await resetStudentPassword(student.id));
  });
