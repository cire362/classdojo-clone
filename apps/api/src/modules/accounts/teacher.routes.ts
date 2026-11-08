import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { changeOwnPassword, renameTeacher } from './service.js';

const ProfileBody = z.object({ name: z.string().trim().min(1, 'Введите имя').max(80) });

/** Профиль преподавателя. Роль проверяет сборка routes/teacher.ts */
export const teacherAccountRoutes = new Hono<AppEnv>()
  .patch('/me', async (c) => {
    const { name } = parse(ProfileBody, await c.req.json().catch(() => null));
    return c.json(await renameTeacher(c.get('user').teacherId!, name));
  })
  .post('/me/password', async (c) => {
    await changeOwnPassword(c.get('user'), await c.req.json().catch(() => null));
    return c.json({ ok: true });
  });
