import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { teacherStudent } from '../access/index.js';
import { saveHero } from './service.js';

/** Герой ученика. Роль проверяет сборка routes/teacher.ts */
export const teacherHeroRoutes = new Hono<AppEnv>().put('/students/:id/hero', async (c) => {
  const student = await teacherStudent(c.get('user'), c.req.param('id'));
  return c.json(await saveHero(student.id, await c.req.json().catch(() => null)));
});
