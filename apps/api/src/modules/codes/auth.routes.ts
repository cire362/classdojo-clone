import { Hono } from 'hono';
import { z } from 'zod';
import { limitedCodeAttempt, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { signInAs } from '../accounts/index.js';
import { cardAccount, classCodeAccount, classRoster } from './service.js';

const CardBody = z.object({ token: z.string().min(1).max(100) });
const CodeBody = z.object({ code: z.string().min(1).max(20) });
const CodeLoginBody = CodeBody.extend({ studentId: z.string().min(1).max(64) });

/** Вход учеников без пароля. Подключается к /api/auth в app.ts */
export const codeLoginRoutes = new Hono<AppEnv>()
  .post('/qr', async (c) => {
    const { token } = parse(CardBody, await c.req.json().catch(() => null));
    return c.json({ user: await signInAs(c, await limitedCodeAttempt(c, () => cardAccount(token))) });
  })
  .post('/class-code', async (c) => {
    const { code } = parse(CodeBody, await c.req.json().catch(() => null));
    return c.json(await limitedCodeAttempt(c, () => classRoster(code)));
  })
  .post('/class-code/login', async (c) => {
    const { code, studentId } = parse(CodeLoginBody, await c.req.json().catch(() => null));
    return c.json({ user: await signInAs(c, await limitedCodeAttempt(c, () => classCodeAccount(code, studentId))) });
  });
