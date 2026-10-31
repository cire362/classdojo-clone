import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { MAX_POST_LENGTH, createPost, deletePost, groupFeed } from './service.js';

const PostBody = z.object({ text: z.string().trim().min(1, 'Напишите текст').max(MAX_POST_LENGTH) });

/** Лента группы для преподавателя. Роль проверяет сборка routes/teacher.ts */
export const teacherFeedRoutes = new Hono<AppEnv>()
  .get('/groups/:id/feed', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'));
    return c.json(await groupFeed(group.id, { accountId: user.accountId, teacherId: user.teacherId, isOwner: group.isOwner }));
  })
  .post('/groups/:id/feed', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'), { writable: true });
    const { text } = parse(PostBody, await c.req.json().catch(() => null));
    return c.json(await createPost(group.id, user.teacherId!, text), 201);
  })
  .delete('/posts/:id', async (c) => {
    await deletePost(c.get('user').teacherId!, c.req.param('id'));
    return c.json({ ok: true });
  });
