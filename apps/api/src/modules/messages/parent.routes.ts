import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { parentChild } from '../access/index.js';
import { parentNotice } from './quiet.service.js';
import { MessageBody } from './schemas.js';
import { sendMessage, threadMessages } from './service.js';

/** Переписка родителя о ребёнке. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentMessageRoutes = new Hono<AppEnv>()
  .get('/children/:id/messages', async (c) => {
    const user = c.get('user');
    const studentId = await parentChild(user.parentId!, c.req.param('id'));
    return c.json(await threadMessages(studentId, user.parentId!, user.accountId));
  })
  .post('/children/:id/messages', async (c) => {
    const user = c.get('user');
    const studentId = await parentChild(user.parentId!, c.req.param('id'));
    const { text } = parse(MessageBody, await c.req.json().catch(() => null));
    return c.json(await sendMessage(studentId, user.parentId!, user.accountId, text), 201);
  })
  .get('/children/:id/quiet-hours', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await parentNotice(studentId));
  });
