import { Hono } from 'hono';
import { normalizeHero } from '@heroes/shared';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { prisma } from '../platform/db.js';
import { HttpError, parse } from '../platform/errors.js';
import { validateHeroForLevel } from '../services/heroParts.js';
import { studentLevel } from '../services/points.js';
import { groupFeed } from '../services/feed.js';
import { cancelRequest, requestReward, studentShop } from '../services/rewards.js';
import { markNewsSeen, studentNews } from '../services/news.js';
import { studentHasPremium } from '../services/premium.js';
import { studentProfile } from '../services/profile.js';
import { readStudentNotifications, studentNotifications } from '../services/studentNotifications.js';

export const HeroBody = z.object({
  name: z.string().trim().max(40),
  parts: z.record(z.string(), z.string()),
});

/** Общая логика сохранения героя: проверяем детали по уровню ученика */
export async function saveHero(studentId: string, body: unknown) {
  const { name, parts } = parse(HeroBody, body);
  const [level, premium] = await Promise.all([studentLevel(studentId), studentHasPremium(studentId)]);
  // Вкладка старой версии может ещё не знать о питомце: сохраняем выбор из БД.
  if (parts.pet === undefined) {
    const saved = await prisma.hero.findUnique({ where: { studentId }, select: { parts: true } });
    parts.pet = normalizeHero(saved?.parts).pet;
  }
  const check = await validateHeroForLevel(parts, level.level, premium);
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
  .get('/notifications', async (c) => {
    const query = parse(z.object({ before: z.string().max(200).optional(), through: z.string().datetime().optional() }), c.req.query());
    return c.json(await studentNotifications(c.get('user').studentId!, query));
  })
  .post('/notifications/read', async (c) => {
    const body = parse(z.object({ groupId: z.string().min(1).max(100), through: z.string().datetime() }), await c.req.json().catch(() => null));
    await readStudentNotifications(c.get('user').studentId!, body.groupId, body.through);
    return c.json({ ok: true });
  })
  .put('/hero', async (c) => c.json(await saveHero(c.get('user').studentId!, await c.req.json().catch(() => null))))
  .get('/shop', async (c) => c.json(await studentShop(c.get('user').studentId!)))
  .post('/shop/:rewardId/request', async (c) => {
    await requestReward(c.get('user').studentId!, c.req.param('rewardId'));
    return c.json(await studentShop(c.get('user').studentId!), 201);
  })
  .delete('/shop/requests/:id', async (c) => {
    await cancelRequest(c.get('user').studentId!, c.req.param('id'));
    return c.json(await studentShop(c.get('user').studentId!));
  })
  .get('/feed', async (c) => {
    const user = c.get('user');
    const s = await prisma.student.findUniqueOrThrow({ where: { id: user.studentId! }, select: { groupId: true } });
    return c.json(await groupFeed(s.groupId, { accountId: user.accountId }));
  })
  .get('/news', async (c) => c.json(await studentNews(c.get('user').studentId!)))
  .post('/news/seen', async (c) => {
    const { kind } = parse(z.object({ kind: z.enum(['level', 'parts']) }), await c.req.json().catch(() => null));
    return c.json(await markNewsSeen(c.get('user').studentId!, kind));
  });
