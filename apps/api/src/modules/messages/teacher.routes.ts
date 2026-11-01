import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { quietHours, saveQuietHours } from './quiet.service.js';
import { QuietBody, TeacherMessageBody } from './schemas.js';
import { broadcastMessage, cancelMessage, sendTeacherMessage, teacherThread, teacherThreads, threadMessages } from './service.js';

/** Переписка с родителями. Роль проверяет сборка routes/teacher.ts */
export const teacherMessageRoutes = new Hono<AppEnv>()
  .get('/messages', async (c) => c.json(await teacherThreads(c.get('user').teacherId!, c.get('user').accountId)))
  .get('/students/:id/parents/:parentId/messages', async (c) => {
    const user = c.get('user');
    const thread = await teacherThread(user.teacherId!, c.req.param('id'), c.req.param('parentId'));
    return c.json({ ...thread, messages: await threadMessages(c.req.param('id'), c.req.param('parentId'), user.accountId, true) });
  })
  .post('/students/:id/parents/:parentId/messages', async (c) => {
    const user = c.get('user');
    await teacherThread(user.teacherId!, c.req.param('id'), c.req.param('parentId'));
    const { text, sendAt } = parse(TeacherMessageBody, await c.req.json().catch(() => null));
    return c.json(await sendTeacherMessage(c.req.param('id'), c.req.param('parentId'), user.accountId, text, sendAt), 201);
  })
  .delete('/students/:id/parents/:parentId/messages/:messageId', async (c) => {
    const user = c.get('user');
    await teacherThread(user.teacherId!, c.req.param('id'), c.req.param('parentId'));
    return c.json(await cancelMessage(c.req.param('id'), c.req.param('parentId'), c.req.param('messageId'), user.accountId));
  })
  .post('/groups/:id/messages', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'), { writable: true });
    const { text, sendAt } = parse(TeacherMessageBody, await c.req.json().catch(() => null));
    return c.json(await broadcastMessage(group.id, user.accountId, text, sendAt), 201);
  })
  .get('/me/quiet-hours', async (c) => c.json({ hours: await quietHours(c.get('user').teacherId!) }))
  .put('/me/quiet-hours', async (c) => {
    const { hours } = parse(QuietBody, await c.req.json().catch(() => null));
    return c.json({ hours: await saveQuietHours(c.get('user').teacherId!, hours) });
  });
