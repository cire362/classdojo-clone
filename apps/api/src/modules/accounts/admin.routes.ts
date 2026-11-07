import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { LOGIN_PATTERN } from '../../platform/credentials.js';
import { parse } from '../../platform/errors.js';
import {
  adminGroups, adminTeachers, createTeacher, renameSchool, resetTeacherPassword, schoolInfo, setTeacherPremium,
} from './admin.service.js';
import { changeOwnPassword } from './service.js';

export const TeacherBody = z.object({
  name: z.string().trim().min(1, 'Введите имя преподавателя').max(80),
  login: z.string().trim().toLowerCase().regex(LOGIN_PATTERN, 'Логин: 3–64 символа, латиница, цифры, точка или дефис'),
});
const SchoolBody = z.object({ name: z.string().trim().min(1, 'Введите название школы').max(120) });
const PremiumBody = z.object({
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((key) => {
    const d = new Date(`${key}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key;
  }, 'Укажите существующую дату').nullable(),
});

const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');

/**
 * Администрация школы: всё в пределах своей школы, остальным ролям маршруты закрыты.
 * Смотреть может любой сотрудник, менять преподавателей — директор и завуч, название школы — только директор
 */
export const adminRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .post('/me/password', async (c) => {
    await changeOwnPassword(c.get('user'), await c.req.json().catch(() => null));
    return c.json({ ok: true });
  })
  .get('/school', async (c) => c.json(await schoolInfo(c.get('user'))))
  .patch('/school', requireSchoolRole('DIRECTOR'), async (c) => {
    const { name } = parse(SchoolBody, await c.req.json().catch(() => null));
    return c.json(await renameSchool(c.get('user'), name));
  })
  .get('/teachers', async (c) => c.json(await adminTeachers(c.get('user').schoolId!)))
  .post('/teachers', MANAGERS, async (c) => {
    const { name, login } = parse(TeacherBody, await c.req.json().catch(() => null));
    return c.json(await createTeacher(c.get('user').schoolId!, name, login), 201);
  })
  .post('/teachers/:id/reset-password', MANAGERS, async (c) => {
    return c.json(await resetTeacherPassword(c.get('user').schoolId!, c.req.param('id')));
  })
  .put('/teachers/:id/premium', MANAGERS, async (c) => {
    const { until } = parse(PremiumBody, await c.req.json().catch(() => null));
    return c.json(await setTeacherPremium(c.get('user').schoolId!, c.req.param('id'), until));
  })
  .get('/groups', async (c) => c.json(await adminGroups(c.get('user').schoolId!)));
