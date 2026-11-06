import { createHash, randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Role } from '../generated/prisma/client';
import { prisma } from './db.js';
import { env } from './env.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'hk_session';

export interface AuthUser {
  /** id текущей сессии (sha256 токена) */
  sessionId: string;
  accountId: string;
  login: string;
  role: Role;
  name: string;
  teacherId: string | null;
  studentId: string | null;
  parentId: string | null;
  /** Школа преподавателя или администратора; у ученика и родителя её нет */
  schoolId: string | null;
}

export type AppEnv = { Variables: { user: AuthUser } };

/** Связи аккаунта, по которым строятся роль и отображаемое имя */
export const ACCOUNT_PROFILE = {
  admin: true,
  teacher: true,
  student: true,
  parent: { include: { children: { include: { student: { select: { name: true } } } } } },
} as const;

type AccountWithProfile = {
  admin: { name: string } | null;
  login: string;
  teacher: { name: string } | null;
  student: { name: string } | null;
  parent: { children: { student: { name: string } }[] } | null;
};

/** Имя в шапке: у родителя — имена его детей */
export function accountName(a: AccountWithProfile): string {
  if (a.admin) return a.admin.name;
  if (a.teacher) return a.teacher.name;
  if (a.student) return a.student.name;
  if (a.parent) {
    const names = a.parent.children.map((ch) => ch.student.name).sort();
    return names.length ? `Родитель: ${names.join(', ')}` : 'Родитель';
  }
  return a.login;
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Адрес клиента для ограничения попыток: прокси передаёт его в заголовке */
export const clientIp = (c: Context) => c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

export async function createSession(c: Context, accountId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 3600 * 1000);
  await prisma.session.create({ data: { id: sha256(token), accountId, expiresAt } });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(c: Context): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function loadUser(c: Context): Promise<AuthUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { account: { include: ACCOUNT_PROFILE } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const a = session.account;
  return {
    sessionId: session.id,
    accountId: a.id,
    login: a.login,
    role: a.role,
    name: accountName(a),
    teacherId: a.teacher?.id ?? null,
    studentId: a.student?.id ?? null,
    parentId: a.parent?.id ?? null,
    schoolId: a.teacher?.schoolId ?? a.admin?.schoolId ?? null,
  };
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await loadUser(c);
  if (!user) throw new HttpError(401, 'Нужно войти');
  c.set('user', user);
  await next();
};

export function requireRole(role: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.get('user').role !== role) throw new HttpError(403, 'Недостаточно прав');
    await next();
  };
}

/**
 * Защита от перебора паролей: не больше N попыток за 15 минут на пару «IP + логин».
 * Счётчик хранится в PostgreSQL, поэтому работает и при нескольких копиях API, и после перезапуска.
 * Атомарный upsert: одновременные запросы не обходят лимит.
 */
const WINDOW_MINUTES = 15;

export async function checkLoginRate(key: string, limit = env.loginRateLimit): Promise<void> {
  const id = sha256(key);
  // Prisma хранит время в UTC без часового пояса, поэтому и сравниваем с UTC
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "LoginAttempt" ("key", "count", "resetAt")
    VALUES (${id}, 1, (NOW() AT TIME ZONE 'UTC') + make_interval(mins => ${WINDOW_MINUTES}::int))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginAttempt"."resetAt" < (NOW() AT TIME ZONE 'UTC') THEN 1 ELSE "LoginAttempt"."count" + 1 END,
      "resetAt" = CASE WHEN "LoginAttempt"."resetAt" < (NOW() AT TIME ZONE 'UTC') THEN (NOW() AT TIME ZONE 'UTC') + make_interval(mins => ${WINDOW_MINUTES}::int) ELSE "LoginAttempt"."resetAt" END
    RETURNING "count", "resetAt"`;
  // Изредка подчищаем давно истёкшие записи
  if (Math.random() < 0.02) void cleanupLoginAttempts();
  const { count, resetAt } = rows[0];
  if (count > limit) {
    const seconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
    const minutes = Math.ceil(seconds / 60);
    throw new HttpError(429, `Слишком много попыток входа. Попробуйте через ${minutes} мин.`, { 'Retry-After': String(seconds) });
  }
}

/**
 * Вернуть попытку после успеха: для кодов считаются только ошибки, иначе весь класс за одним адресом
 * упёрся бы в лимит. Сам счётчик атомарный, поэтому параллельные запросы его не обходят.
 */
export async function releaseLoginAttempt(key: string): Promise<void> {
  await prisma.loginAttempt.updateMany({ where: { key: sha256(key), count: { gt: 0 } }, data: { count: { decrement: 1 } } });
}

/** Ошибочных попыток с одного адреса за 15 минут: с запасом на опечатки целого класса */
const CODE_ATTEMPT_LIMIT = 60;

/** Все виды кодов считают ошибки вместе: перебирать один вид, пока лимит другого свободен, нельзя */
export async function limitedCodeAttempt<T>(c: Context, check: () => Promise<T>): Promise<T> {
  const key = `code|${clientIp(c)}`;
  await checkLoginRate(key, CODE_ATTEMPT_LIMIT);
  const result = await check();
  await releaseLoginAttempt(key);
  return result;
}

export async function resetLoginRate(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: sha256(key) } });
}

export async function cleanupLoginAttempts(): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => undefined);
}
