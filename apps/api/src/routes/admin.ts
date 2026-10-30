import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { LOGIN_PATTERN, generatePassword, hashPassword } from '../lib/credentials.js';
import { addDays, localDayStart } from '../lib/dates.js';
import { HttpError, notFound, parse } from '../lib/errors.js';
import { changeOwnPassword } from '../services/password.js';
import { isActive } from '../services/premium.js';

const TeacherBody = z.object({
  name: z.string().trim().min(1, 'Введите имя преподавателя').max(80),
  login: z.string().trim().toLowerCase().regex(LOGIN_PATTERN, 'Логин: 3–64 символа, латиница, цифры, точка или дефис'),
});
const PremiumBody = z.object({
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((key) => {
    const d = new Date(`${key}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key;
  }, 'Укажите существующую дату').nullable(),
});

/** Вся установка — одна школа. Эти маршруты закрыты от всех остальных ролей. */
export const adminRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .post('/me/password', async (c) => {
    await changeOwnPassword(c.get('user'), await c.req.json().catch(() => null));
    return c.json({ ok: true });
  })
  .get('/teachers', async (c) => {
    const teachers = await prisma.teacher.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true, name: true, premiumUntil: true, account: { select: { login: true } },
        _count: { select: { groups: true, coGroups: true } },
      },
    });
    return c.json({ freeForAll: env.premiumForAll, teachers: teachers.map((t) => ({
      id: t.id, name: t.name, login: t.account.login,
      ownedGroups: t._count.groups, sharedGroups: t._count.coGroups,
      premiumUntil: t.premiumUntil, premiumActive: isActive(t.premiumUntil),
    })) });
  })
  .post('/teachers', async (c) => {
    const { name, login } = parse(TeacherBody, await c.req.json().catch(() => null));
    const password = generatePassword();
    try {
      const teacher = await prisma.teacher.create({
        data: { name, account: { create: { login, role: 'TEACHER', passwordHash: await hashPassword(password) } } },
        select: { id: true },
      });
      return c.json({ id: teacher.id, name, login, password }, 201);
    } catch (err) {
      // Уникальность проверяет БД, в том числе при двух одновременных запросах.
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        throw new HttpError(409, 'Этот логин уже занят. Выберите другой');
      }
      throw err;
    }
  })
  .post('/teachers/:id/reset-password', async (c) => {
    const teacher = await prisma.teacher.findUnique({ where: { id: c.req.param('id') }, select: { id: true, name: true, accountId: true, account: { select: { login: true } } } });
    if (!teacher) throw notFound('Преподаватель не найден');
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    // Старый пароль и все старые сессии перестают работать вместе.
    await prisma.$transaction([
      prisma.account.update({ where: { id: teacher.accountId }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { accountId: teacher.accountId } }),
    ]);
    return c.json({ id: teacher.id, name: teacher.name, login: teacher.account.login, password });
  })
  .put('/teachers/:id/premium', async (c) => {
    const { until } = parse(PremiumBody, await c.req.json().catch(() => null));
    // Доступ до конца выбранного дня в часовом поясе школы
    const premiumUntil = until ? new Date(addDays(localDayStart(until), 1).getTime() - 1) : null;
    if (premiumUntil && premiumUntil <= new Date()) throw new HttpError(400, 'Выберите сегодняшнюю или будущую дату');
    const { count } = await prisma.teacher.updateMany({ where: { id: c.req.param('id') }, data: { premiumUntil } });
    if (!count) throw notFound('Преподаватель не найден');
    return c.json({ premiumUntil, premiumActive: isActive(premiumUntil), freeForAll: env.premiumForAll });
  })
  .get('/groups', async (c) => {
    const groups = await prisma.group.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true, name: true, archivedAt: true,
        teacher: { select: { id: true, name: true, account: { select: { login: true } } } },
        coTeachers: { orderBy: { createdAt: 'asc' }, select: { teacher: { select: { id: true, name: true } } } },
        _count: { select: { students: true } },
      },
    });
    return c.json(groups.map((g) => ({
      id: g.id, name: g.name, archivedAt: g.archivedAt,
      owner: { id: g.teacher.id, name: g.teacher.name, login: g.teacher.account.login },
      colleagues: g.coTeachers.map((t) => t.teacher), studentsCount: g._count.students,
    })));
  });
