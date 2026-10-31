import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { HttpError, parse } from '../../platform/errors.js';
import { OWNER_ONLY_MESSAGE, teacherGroup } from '../access/index.js';
import { GroupCreate, GroupPatch, TeacherLogin } from './schemas.js';
import { archiveGroup, createGroup, deleteGroup, groupDetails, restoreGroup, teacherGroups, updateGroup } from './service.js';
import { addCoTeacher, groupTeachers, removeCoTeacher } from './teachers.service.js';

/** Группы и их преподаватели. Роль проверяет сборка routes/teacher.ts */
export const groupRoutes = new Hono<AppEnv>()
  .get('/groups', async (c) => c.json(await teacherGroups(c.get('user').teacherId!)))
  .post('/groups', async (c) => {
    const { name } = parse(GroupCreate, await c.req.json().catch(() => null));
    return c.json(await createGroup(c.get('user').teacherId!, name), 201);
  })
  .get('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await groupDetails(group));
  })
  .patch('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const data = parse(GroupPatch, await c.req.json().catch(() => null));
    if (data.name !== undefined && data.name !== group.name && !group.isOwner) throw new HttpError(403, OWNER_ONLY_MESSAGE);
    return c.json(await updateGroup(group.id, data));
  })
  .post('/groups/:id/archive', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    return c.json(await archiveGroup(group.id, group.archivedAt));
  })
  .post('/groups/:id/restore', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    return c.json(await restoreGroup(group.id));
  })
  .delete('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    await deleteGroup(group.id);
    return c.json({ ok: true });
  })
  .get('/groups/:id/teachers', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await groupTeachers(group.id, c.get('user').teacherId!));
  })
  .post('/groups/:id/teachers', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    const { login } = parse(TeacherLogin, await c.req.json().catch(() => null));
    await addCoTeacher(group, login);
    return c.json(await groupTeachers(group.id, c.get('user').teacherId!));
  })
  /** Владелец убирает соавтора; соавтор может убрать только себя (выйти из группы) */
  .delete('/groups/:id/teachers/:teacherId', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'));
    const teacherId = c.req.param('teacherId');
    if (!group.isOwner && teacherId !== user.teacherId) throw new HttpError(403, OWNER_ONLY_MESSAGE);
    await removeCoTeacher(group.id, teacherId);
    return c.json({ ok: true });
  });
