import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { checkLoginRate, clientIp, createSession, destroySession, releaseLoginAttempt, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { accountView } from '../accounts/index.js';
import { cardAccount, classCodeAccount, classRoster } from './service.js';

/** Ошибочных попыток с одного адреса за 15 минут: с запасом на опечатки целого класса */
const ATTEMPT_LIMIT = 60;

const CardBody = z.object({ token: z.string().min(1).max(100) });
const CodeBody = z.object({ code: z.string().min(1).max(20) });
const CodeLoginBody = CodeBody.extend({ studentId: z.string().min(1).max(64) });

/** Все коды считают ошибки вместе: перебирать один вид кодов, пока лимит другого свободен, нельзя */
async function limited<T>(c: Context, check: () => Promise<T>): Promise<T> {
  const key = `code|${clientIp(c)}`;
  await checkLoginRate(key, ATTEMPT_LIMIT);
  const result = await check();
  await releaseLoginAttempt(key);
  return result;
}

async function signIn(c: Context<AppEnv>, accountId: string) {
  await destroySession(c);
  await createSession(c, accountId);
  return c.json({ user: await accountView(accountId) });
}

/** Вход учеников без пароля. Подключается к /api/auth в app.ts */
export const codeLoginRoutes = new Hono<AppEnv>()
  .post('/qr', async (c) => {
    const { token } = parse(CardBody, await c.req.json().catch(() => null));
    return signIn(c, await limited(c, () => cardAccount(token)));
  })
  .post('/class-code', async (c) => {
    const { code } = parse(CodeBody, await c.req.json().catch(() => null));
    return c.json(await limited(c, () => classRoster(code)));
  })
  .post('/class-code/login', async (c) => {
    const { code, studentId } = parse(CodeLoginBody, await c.req.json().catch(() => null));
    return signIn(c, await limited(c, () => classCodeAccount(code, studentId)));
  });
