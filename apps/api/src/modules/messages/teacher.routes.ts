import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { MessageBody } from './schemas.js';
import { sendMessage, teacherThread, teacherThreads, threadMessages } from './service.js';

/** Переписка с родителями. Роль проверяет сборка routes/teacher.ts */
export const teacherMessageRoutes = new Hono<AppEnv>()
  .get('/messages', async (c) => c.json(await teacherThreads(c.get('user').teacherId!, c.get('user').accountId)))
  .get('/students/:id/parents/:parentId/messages', async (c) => {
    const user = c.get('user');
    const thread = await teacherThread(user.teacherId!, c.req.param('id'), c.req.param('parentId'));
    return c.json({ ...thread, messages: await threadMessages(c.req.param('id'), c.req.param('parentId'), user.accountId) });
  })
  .post('/students/:id/parents/:parentId/messages', async (c) => {
    const user = c.get('user');
    await teacherThread(user.teacherId!, c.req.param('id'), c.req.param('parentId'));
    const { text } = parse(MessageBody, await c.req.json().catch(() => null));
    return c.json(await sendMessage(c.req.param('id'), c.req.param('parentId'), user.accountId, text), 201);
  });
