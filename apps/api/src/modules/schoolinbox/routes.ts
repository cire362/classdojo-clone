import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../../platform/auth.js';
import { messageInput, messageLimit } from '../messages/index.js';
import { inboxThread, markHandled, parentSchoolThreads, parentWrite, schoolInbox, schoolReply } from './service.js';

/** Родитель пишет школам своих детей. Роль проверяет routes/parent.ts, чужая школа — 404 */
export const parentSchoolInboxRoutes = new Hono<AppEnv>()
  .get('/school-messages', async (c) => c.json(await parentSchoolThreads(c.get('user'))))
  .post('/school-messages/:schoolId', messageLimit, async (c) => {
    const { text, files } = await messageInput(c);
    return c.json(await parentWrite(c.get('user'), c.req.param('schoolId'), text, files), 201);
  });

/** Ящик школы: читает и отвечает любой сотрудник администрации, чужая переписка — 404 */
export const adminSchoolInboxRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/inbox', async (c) => c.json(await schoolInbox(c.get('user').schoolId!)))
  .get('/inbox/:id', async (c) => c.json(await inboxThread(c.get('user'), c.req.param('id'))))
  .post('/inbox/:id', messageLimit, async (c) => {
    const { text, files } = await messageInput(c);
    return c.json(await schoolReply(c.get('user'), c.req.param('id'), text, files), 201);
  })
  .post('/inbox/:id/handled', async (c) => c.json(await markHandled(c.get('user'), c.req.param('id'))));
