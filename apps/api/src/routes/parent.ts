import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { parse } from '../platform/errors.js';
import { parentFeedRoutes, unreadPosts } from '../modules/feed/index.js';
import { MAX_MESSAGE_LENGTH, sendMessage, threadMessages, unreadMessages } from '../services/messages.js';
import { parentChild, parentChildren } from '../services/parents.js';
import { studentProfile } from '../services/profile.js';
import { weeklySummary } from '../services/weekly-summary.js';
import { parentRewards } from '../services/rewards.js';

/** Кабинет родителя: только просмотр и только своих детей (чужие — 404) */
export const parentRoutes = new Hono<AppEnv>()
  .use(requireRole('PARENT'))
  .get('/children', async (c) => {
    const user = c.get('user');
    const children = await parentChildren(user.parentId!);
    // Значки на вкладках детей: новые сообщения и записи в ленте
    const withUnread = await Promise.all(
      children.map(async (ch) => ({
        ...ch,
        unread: {
          messages: await unreadMessages(user.accountId, [{ studentId: ch.id, parentId: user.parentId! }]),
          feed: await unreadPosts(user.accountId, [ch.groupId]),
        },
      })),
    );
    return c.json(withUnread);
  })
  .route('/', parentFeedRoutes)
  .get('/children/:id/messages', async (c) => {
    const user = c.get('user');
    const studentId = await parentChild(user.parentId!, c.req.param('id'));
    return c.json(await threadMessages(studentId, user.parentId!, user.accountId));
  })
  .post('/children/:id/messages', async (c) => {
    const user = c.get('user');
    const studentId = await parentChild(user.parentId!, c.req.param('id'));
    const { text } = parse(z.object({ text: z.string().trim().min(1, 'Напишите сообщение').max(MAX_MESSAGE_LENGTH) }), await c.req.json().catch(() => null));
    return c.json(await sendMessage(studentId, user.parentId!, user.accountId, text), 201);
  })
  .get('/children/:id/profile', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await studentProfile(studentId));
  })
  .get('/children/:id/weekly-summary', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await weeklySummary(studentId, c.req.query('week')));
  })
  .get('/children/:id/rewards', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await parentRewards(studentId, c.req.query('before')));
  });
