import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { HttpError, parse } from '../../platform/errors.js';
import { ARCHIVED_MESSAGE, teacherGroup, teacherStudent } from '../access/index.js';
import { activeInvites, createGroupInvites, createInvite, revokeInvite } from './invites.service.js';
import { issueGroupParents, issueParent, linkParent, resetParentPassword, studentParents, unlinkParent } from './service.js';

const ParentLink = z.object({ login: z.string().trim().min(1).max(64) });

/** Входы родителей. Роль проверяет сборка routes/teacher.ts */
export const teacherParentRoutes = new Hono<AppEnv>()
  .get('/students/:id/parents', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await studentParents(student.id));
  })
  .post('/students/:id/parents', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    if (student.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
    return c.json(await issueParent({ id: student.id, name: student.name }));
  })
  .post('/students/:id/parents/link', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    if (student.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
    const { login } = parse(ParentLink, await c.req.json().catch(() => null));
    await linkParent(user.teacherId!, student.id, login);
    return c.json(await studentParents(student.id));
  })
  .delete('/students/:id/parents/:parentId', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    await unlinkParent(user.teacherId!, student.id, c.req.param('parentId'));
    return c.json(await studentParents(student.id));
  })
  .post('/students/:id/parents/:parentId/reset-password', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    return c.json(await resetParentPassword(user.teacherId!, c.req.param('parentId'), student.id));
  })
  .get('/students/:id/parent-invites', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await activeInvites(student.id));
  })
  .post('/students/:id/parent-invites', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    if (student.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
    return c.json(await createInvite({ id: student.id, name: student.name }), 201);
  })
  .delete('/students/:id/parent-invites/:inviteId', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    await revokeInvite(student.id, c.req.param('inviteId'));
    return c.json({ ok: true });
  })
  .post('/groups/:id/parent-invites', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    return c.json({ invites: await createGroupInvites(group.id) }, 201);
  })
  .post('/groups/:id/parents', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    return c.json({ credentials: await issueGroupParents(group.id) });
  });
