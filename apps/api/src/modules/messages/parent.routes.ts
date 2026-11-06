import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parentChild } from '../access/index.js';
import { parentNotice } from './quiet.service.js';
import { messageInput, messageLimit } from './input.js';
import { sendMessage, threadMessages } from './service.js';

/** Переписка родителя о ребёнке. Роль проверяет routes/parent.ts, чужой ребёнок — 404 */
export const parentMessageRoutes = new Hono<AppEnv>()
  .get('/children/:id/messages', async (c) => {
    const user = c.get('user');
    const studentId = await parentChild(user.parentId!, c.req.param('id'));
    return c.json(await threadMessages(studentId, user.parentId!, user.accountId));
  })
  .post('/children/:id/messages', messageLimit, async (c) => {
    const user = c.get('user');
    const studentId = await parentChild(user.parentId!, c.req.param('id'));
    // Отложенная отправка есть только у преподавателя: sendAt родителя не учитывается
    const { text, files } = await messageInput(c);
    return c.json(await sendMessage(studentId, user.parentId!, user.accountId, text, files), 201);
  })
  .get('/children/:id/quiet-hours', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await parentNotice(studentId));
  });
