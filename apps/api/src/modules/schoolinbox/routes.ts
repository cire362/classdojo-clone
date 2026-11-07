import { Hono } from 'hono';
import { requireRole, type AppEnv } from '../../platform/auth.js';
import { messageInput, messageLimit } from '../messages/index.js';
import { inboxThread, markHandled, readerThreads, readerWrite, schoolInbox, schoolReply } from './service.js';

/**
 * Родитель пишет учреждениям своих детей, студент колледжа или вуза — своему. Роль проверяют routes/parent.ts
 * и routes/student.ts; чужое учреждение и ящик школьника — 404
 */
export const readerSchoolInboxRoutes = new Hono<AppEnv>()
  .get('/school-messages', async (c) => c.json(await readerThreads(c.get('user'))))
  .post('/school-messages/:schoolId', messageLimit, async (c) => {
    const { text, files } = await messageInput(c);
    return c.json(await readerWrite(c.get('user'), c.req.param('schoolId'), text, files), 201);
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
