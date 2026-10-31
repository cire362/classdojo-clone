import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherStudent } from '../access/index.js';
import { addPortfolioItem, deletePortfolioItem } from './service.js';

const PortfolioBody = z.object({
  title: z.string().trim().min(1, 'Введите название').max(100),
  description: z.string().trim().max(1000).default(''),
  emoji: z.string().trim().min(1).max(16).default('🏆'),
});

/** Портфолио ученика. Роль проверяет сборка routes/teacher.ts */
export const portfolioRoutes = new Hono<AppEnv>()
  .post('/students/:id/portfolio', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    const data = parse(PortfolioBody, await c.req.json().catch(() => null));
    return c.json(await addPortfolioItem(student.id, user.accountId, data), 201);
  })
  .delete('/portfolio/:id', async (c) => c.json(await deletePortfolioItem(c.get('user').teacherId!, c.req.param('id'))));
