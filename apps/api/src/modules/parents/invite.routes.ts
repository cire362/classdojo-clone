import { Hono } from 'hono';
import { z } from 'zod';
import { limitedCodeAttempt, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { NewPassword, signInAs } from '../accounts/index.js';
import { acceptInvite, addChildByInvite, previewInvite } from './invites.service.js';

const CodeBody = z.object({ code: z.string().min(1).max(30) });
const AcceptBody = CodeBody.extend({ password: NewPassword });

/** Приглашение без входа. Подключается к /api/auth в app.ts */
export const inviteRoutes = new Hono<AppEnv>()
  .post('/invite', async (c) => {
    const { code } = parse(CodeBody, await c.req.json().catch(() => null));
    return c.json(await limitedCodeAttempt(c, () => previewInvite(code)));
  })
  .post('/invite/accept', async (c) => {
    const { code, password } = parse(AcceptBody, await c.req.json().catch(() => null));
    const { accountId, login } = await limitedCodeAttempt(c, () => acceptInvite(code, password));
    return c.json({ user: await signInAs(c, accountId), login });
  });

/** Родитель с готовым входом добавляет ребёнка. Роль проверяет routes/parent.ts */
export const parentInviteRoutes = new Hono<AppEnv>().post('/invite', async (c) => {
  const { code } = parse(CodeBody, await c.req.json().catch(() => null));
  return c.json(await limitedCodeAttempt(c, () => addChildByInvite(c.get('user').parentId!, code)));
});
