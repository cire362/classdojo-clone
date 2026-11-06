import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { HiddenBody, TargetParam } from './schemas.js';
import { groupModeration, setHidden } from './service.js';

/**
 * Жалобы и журнал группы для любого её преподавателя. Работает и в архивной группе: убрать обидное
 * важнее, чем сохранить архив нетронутым. Роль проверяет сборка routes/teacher.ts
 */
export const moderationRoutes = new Hono<AppEnv>()
  .get('/groups/:id/moderation', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await groupModeration(group.id));
  })
  .put('/groups/:id/moderation/:target/:targetId', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'));
    const target = parse(TargetParam, c.req.param('target'));
    const { hidden } = parse(HiddenBody, await c.req.json().catch(() => null));
    await setHidden(group.id, { accountId: user.accountId, name: user.name }, target, c.req.param('targetId'), hidden);
    return c.json(await groupModeration(group.id));
  });
