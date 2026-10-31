import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { teacherStudent } from '../access/index.js';
import { studentProfile } from './service.js';

/** Профиль ученика для преподавателя. Роль проверяет сборка routes/teacher.ts */
export const teacherProfileRoutes = new Hono<AppEnv>().get('/students/:id/profile', async (c) => {
  const student = await teacherStudent(c.get('user'), c.req.param('id'));
  return c.json(await studentProfile(student.id));
});
