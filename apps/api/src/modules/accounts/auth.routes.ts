import { Hono } from 'hono';
import { z } from 'zod';
import { checkLoginRate, createSession, destroySession, loadUser, resetLoginRate, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { accountView, checkCredentials } from './service.js';

const LoginBody = z.object({
  login: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const authRoutes = new Hono<AppEnv>()
  .post('/login', async (c) => {
    const { login, password } = parse(LoginBody, await c.req.json().catch(() => null));
    const ip = c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const rateKey = `${ip}|${login}`;
    await checkLoginRate(rateKey);
    const accountId = await checkCredentials(login, password);
    await resetLoginRate(rateKey);
    await createSession(c, accountId);
    return c.json({ user: await accountView(accountId) });
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
