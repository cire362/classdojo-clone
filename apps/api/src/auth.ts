import { createHash, randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Role } from '@prisma/client';
import { prisma } from './db.js';
import { env } from './env.js';
import { HttpError } from './lib/errors.js';

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
}

export type AppEnv = { Variables: { user: AuthUser } };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

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
    include: { account: { include: { teacher: true, student: true } } },
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
    name: a.teacher?.name ?? a.student?.name ?? a.login,
    teacherId: a.teacher?.id ?? null,
    studentId: a.student?.id ?? null,
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

/** Простая защита от перебора паролей: N попыток за 15 минут на пару IP+логин */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRate(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  rec.count++;
  if (rec.count > env.loginRateLimit) {
    throw new HttpError(429, 'Слишком много попыток входа. Попробуйте через 15 минут');
  }
}

export function resetLoginRate(key: string): void {
  attempts.delete(key);
}
