import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../auth.js';
import { prisma } from '../db.js';
import { HttpError, parse } from '../lib/errors.js';
import { validateHeroForLevel } from '../services/heroParts.js';
import { studentLevel } from '../services/points.js';
import { markNewsSeen, studentNews } from '../services/news.js';
import { studentProfile } from '../services/profile.js';

export const HeroBody = z.object({
  name: z.string().trim().max(40),
  parts: z.record(z.string(), z.string()),
});

/** Общая логика сохранения героя: проверяем детали по уровню ученика */
export async function saveHero(studentId: string, body: unknown) {
  const { name, parts } = parse(HeroBody, body);
  const level = await studentLevel(studentId);
  const check = await validateHeroForLevel(parts, level.level);
  if (!check.ok) throw new HttpError(422, check.error);
  const hero = await prisma.hero.upsert({
    where: { studentId },
    create: { studentId, name, parts: check.parts },
    update: { name, parts: check.parts },
  });
  return { name: hero.name, parts: check.parts };
}

/** Кабинет ученика: всё строго по studentId из сессии, параметров с чужими id нет */
export const studentRoutes = new Hono<AppEnv>()
  .use(requireRole('STUDENT'))
  .get('/profile', async (c) => c.json(await studentProfile(c.get('user').studentId!)))
  .put('/hero', async (c) => c.json(await saveHero(c.get('user').studentId!, await c.req.json().catch(() => null))))
  .get('/news', async (c) => c.json(await studentNews(c.get('user').studentId!)))
  .post('/news/seen', async (c) => {
    const { kind } = parse(z.object({ kind: z.enum(['level', 'parts']) }), await c.req.json().catch(() => null));
    return c.json(await markNewsSeen(c.get('user').studentId!, kind));
  });
