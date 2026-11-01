import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { EventBody, MonthQuery } from './schemas.js';
import { createEvent, deleteEvent, monthEvents, updateEvent } from './service.js';

/** Календарь группы. Роль проверяет сборка routes/teacher.ts */
export const teacherCalendarRoutes = new Hono<AppEnv>()
  .get('/groups/:id/events', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await monthEvents(group.id, parse(MonthQuery, c.req.query()).month));
  })
  .post('/groups/:id/events', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'), { writable: true });
    const data = parse(EventBody, await c.req.json().catch(() => null));
    return c.json(await createEvent(group.id, user.teacherId!, data), 201);
  })
  .put('/groups/:id/events/:eventId', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'), { writable: true });
    const data = parse(EventBody, await c.req.json().catch(() => null));
    return c.json(await updateEvent(group.id, c.req.param('eventId'), user.teacherId!, data));
  })
  .delete('/groups/:id/events/:eventId', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    await deleteEvent(group.id, c.req.param('eventId'));
    return c.json({ ok: true });
  });
