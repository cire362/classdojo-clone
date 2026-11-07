import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { messageInput, messageLimit } from './input.js';
import { sendMessage, threadMessages } from './service.js';
import { ensureAdultStudent } from './student.service.js';

/** Своя ветка студента колледжа или вуза с преподавателями группы. Роль проверяет routes/student.ts */
export const studentMessageRoutes = new Hono<AppEnv>()
  .get('/messages', async (c) => {
    const user = c.get('user');
    ensureAdultStudent(user.institution);
    return c.json(await threadMessages(user.studentId!, null, user.accountId));
  })
  .post('/messages', messageLimit, async (c) => {
    const user = c.get('user');
    ensureAdultStudent(user.institution);
    // Отложенная отправка есть только у преподавателя: sendAt студента не учитывается
    const { text, files } = await messageInput(c);
    return c.json(await sendMessage(user.studentId!, null, user.accountId, text, files), 201);
  });
