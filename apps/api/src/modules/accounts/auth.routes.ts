import { Hono } from 'hono';
import { z } from 'zod';
import {
  checkLoginRate, clientIp, createSession, destroySession, limitedCodeAttempt, loadUser, resetLoginRate, type AppEnv,
} from '../../platform/auth.js';
import { LOGIN_PATTERN } from '../../platform/credentials.js';
import { parse } from '../../platform/errors.js';
import { ensureVerified, joinSchool, previewJoin } from './join.service.js';
import { NewPassword, accountView, checkCredentials } from './service.js';

const LoginBody = z.object({
  login: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const authRoutes = new Hono<AppEnv>()
  .post('/login', async (c) => {
    const { login, password } = parse(LoginBody, await c.req.json().catch(() => null));
    const rateKey = `${clientIp(c)}|${login}`;
    await checkLoginRate(rateKey);
    const accountId = await checkCredentials(login, password);
    await resetLoginRate(rateKey);
    await ensureVerified(accountId);
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
    const heroes = user.heroes === null ? {} : { heroes: user.heroes };
    return c.json({ user: { login: user.login, role: user.role, name: user.name, institution: user.institution, ...heroes } });
  });

const CodeBody = z.object({ code: z.string().min(1).max(30) });
const JoinBody = CodeBody.extend({
  name: z.string().trim().min(1, 'Введите имя').max(80),
  login: z.string().trim().toLowerCase().regex(LOGIN_PATTERN, 'Логин: 3–64 символа, латиница, цифры, точка или дефис'),
  password: NewPassword,
});

/** Преподаватель подключается к школе по её коду. Вход откроется после проверки директором или завучем */
export const schoolJoinRoutes = new Hono<AppEnv>()
  .post('/school-join/preview', async (c) => {
    const { code } = parse(CodeBody, await c.req.json().catch(() => null));
    return c.json(await limitedCodeAttempt(c, () => previewJoin(code)));
  })
  .post('/school-join', async (c) => {
    const body = parse(JoinBody, await c.req.json().catch(() => null));
    return c.json(await limitedCodeAttempt(c, () => joinSchool(body)), 201);
  });
