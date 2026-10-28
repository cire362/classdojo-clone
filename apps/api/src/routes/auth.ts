import { Hono } from 'hono';
import { z } from 'zod';
import { checkLoginRate, createSession, destroySession, loadUser, resetLoginRate, type AppEnv } from '../auth.js';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/credentials.js';
import { HttpError, parse } from '../lib/errors.js';

const LoginBody = z.object({
  login: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

// Хеш-заглушка: при несуществующем логине всё равно тратим время на проверку,
// чтобы по времени ответа нельзя было узнать, есть ли такой логин
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

export const authRoutes = new Hono<AppEnv>()
  .post('/login', async (c) => {
    const { login, password } = parse(LoginBody, await c.req.json().catch(() => null));
    const ip = c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const rateKey = `${ip}|${login}`;
    await checkLoginRate(rateKey);

    const account = await prisma.account.findUnique({ where: { login } });
    const ok = await verifyPassword(account?.passwordHash ?? (await getDummyHash()), password);
    if (!account || !ok) throw new HttpError(401, 'Неверный логин или пароль');

    await resetLoginRate(rateKey);
    await createSession(c, account.id);
    const user = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
      include: { teacher: true, student: true },
    });
    return c.json({
      user: {
        login: user.login,
        role: user.role,
        name: user.teacher?.name ?? user.student?.name ?? user.login,
      },
    });
  })
  .post('/logout', async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  })
  .get('/me', async (c) => {
    const user = await loadUser(c);
    if (!user) return c.json({ user: null });
    return c.json({ user: { login: user.login, role: user.role, name: user.name } });
  });
