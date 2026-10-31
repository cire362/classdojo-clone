import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { parentFeedRoutes, unreadPosts } from '../modules/feed/index.js';
import { parentMessageRoutes, unreadMessages } from '../modules/messages/index.js';
import { parentChild } from '../modules/access/index.js';
import { parentChildren } from '../services/parents.js';
import { studentProfile } from '../services/profile.js';
import { weeklySummary } from '../services/weekly-summary.js';
import { parentRewardRoutes } from '../modules/rewards/index.js';

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
  .route('/', parentMessageRoutes)
  .get('/children/:id/profile', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await studentProfile(studentId));
  })
  .get('/children/:id/weekly-summary', async (c) => {
    const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
    return c.json(await weeklySummary(studentId, c.req.query('week')));
  })
  .route('/', parentRewardRoutes);
