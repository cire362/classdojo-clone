import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { removeSchoolGoal, saveSchoolGoal, schoolPoints, studentSchoolGoal, teacherGroupIds } from './service.js';

const Period = z.enum(['week', 'month']).catch('week');
const GoalBody = z.object({
  title: z.string().trim().min(1, 'Назовите цель').max(80),
  target: z.number().int().min(10, 'Цель — не меньше 10 баллов').max(1_000_000),
  restart: z.boolean().default(false),
});

/** Цель и рейтинг в панели школы: видит вся администрация, цель ставят директор и завуч */
export const adminSchoolPointsRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/school-points', async (c) => c.json(await schoolPoints(c.get('user').schoolId!, Period.parse(c.req.query('period')))))
  .put('/school-goal', requireSchoolRole('DIRECTOR', 'DEPUTY'), async (c) => {
    const { restart, ...data } = parse(GoalBody, await c.req.json().catch(() => null));
    return c.json(await saveSchoolGoal(c.get('user').schoolId!, data, restart));
  })
  .delete('/school-goal', requireSchoolRole('DIRECTOR', 'DEPUTY'), async (c) => {
    await removeSchoolGoal(c.get('user').schoolId!);
    return c.json({ ok: true });
  });

/** Преподаватель видит цель школы и рейтинг классов со своими группами. Роль проверяет routes/teacher.ts */
export const teacherSchoolPointsRoutes = new Hono<AppEnv>().get('/school-points', async (c) => {
  const user = c.get('user');
  return c.json(await schoolPoints(user.schoolId!, Period.parse(c.req.query('period')), await teacherGroupIds(user.teacherId!)));
});

/** Ученик видит только цель школы, без рейтинга. Роль проверяет routes/student.ts */
export const studentSchoolPointsRoutes = new Hono<AppEnv>().get('/school-goal', async (c) => {
  return c.json({ goal: await studentSchoolGoal(c.get('user').studentId!) });
});
