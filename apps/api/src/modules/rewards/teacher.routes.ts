import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import {
  addReward,
  archiveReward,
  decideRequest,
  groupRequests,
  groupRewards,
  pendingRewardGroups,
  requestGroupId,
} from './service.js';

const RewardBody = z.object({
  title: z.string().trim().min(1, 'Введите название').max(60),
  emoji: z.string().trim().min(1).max(16),
  cost: z.number().int().min(1, 'Цена от 1 балла').max(1000),
});

/** Магазин наград группы. Роль проверяет сборка routes/teacher.ts */
export const teacherRewardRoutes = new Hono<AppEnv>()
  .get('/reward-requests', async (c) => c.json(await pendingRewardGroups(c.get('user').teacherId!)))
  .get('/groups/:id/rewards', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const [rewards, requests] = await Promise.all([groupRewards(group.id), groupRequests(group.id)]);
    return c.json({ rewards, requests });
  })
  .post('/groups/:id/rewards', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const data = parse(RewardBody, await c.req.json().catch(() => null));
    return c.json(await addReward(group.id, data), 201);
  })
  .delete('/rewards/:id', async (c) => c.json(await archiveReward(c.get('user').teacherId!, c.req.param('id'))))
  .post('/reward-requests/:id/:decision{approve|reject}', async (c) => {
    const user = c.get('user');
    const groupId = await requestGroupId(user.teacherId!, c.req.param('id'));
    const group = await teacherGroup(user, groupId, { writable: true });
    await decideRequest(group.id, c.req.param('id'), user.accountId, c.req.param('decision') === 'approve');
    return c.json(await groupRequests(group.id));
  });
