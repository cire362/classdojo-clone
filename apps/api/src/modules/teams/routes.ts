import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { TeamAssign, TeamBody, TeamPatch } from './schemas.js';
import { assignTeams, createTeam, deleteTeam, groupTeams, updateTeam } from './service.js';

/** Команды группы. Роль проверяет сборка routes/teacher.ts */
export const teamRoutes = new Hono<AppEnv>()
  .post('/groups/:id/teams', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { name } = parse(TeamBody, await c.req.json().catch(() => null));
    await createTeam(group.id, name);
    return c.json(await groupTeams(group.id), 201);
  })
  .patch('/groups/:id/teams/:teamId', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    await updateTeam(group.id, c.req.param('teamId'), parse(TeamPatch, await c.req.json().catch(() => null)));
    return c.json(await groupTeams(group.id));
  })
  .delete('/groups/:id/teams/:teamId', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    await deleteTeam(group.id, c.req.param('teamId'));
    return c.json(await groupTeams(group.id));
  })
  .put('/groups/:id/teams/assign', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { assignments } = parse(TeamAssign, await c.req.json().catch(() => null));
    await assignTeams(group.id, assignments);
    return c.json({ ok: true });
  });
