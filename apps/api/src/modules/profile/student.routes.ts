import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { studentProfile } from './service.js';

/** Свой профиль ученика. Роль проверяет routes/student.ts */
export const studentProfileRoutes = new Hono<AppEnv>().get('/profile', async (c) =>
  c.json(await studentProfile(c.get('user').studentId!)),
);
