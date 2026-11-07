import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { ensureHeroes } from '../access/index.js';
import { cancelRequest, requestReward, studentShop } from './service.js';

/** Магазин ученика. Роль проверяет routes/student.ts; без героев в группе магазина нет */
export const studentRewardRoutes = new Hono<AppEnv>()
  .use('/shop/*', async (c, next) => {
    await ensureHeroes(c.get('user').studentId!);
    await next();
  })
  .get('/shop', async (c) => c.json(await studentShop(c.get('user').studentId!)))
  .post('/shop/:rewardId/request', async (c) => {
    await requestReward(c.get('user').studentId!, c.req.param('rewardId'));
    return c.json(await studentShop(c.get('user').studentId!), 201);
  })
  .delete('/shop/requests/:id', async (c) => {
    await cancelRequest(c.get('user').studentId!, c.req.param('id'));
    return c.json(await studentShop(c.get('user').studentId!));
  });
