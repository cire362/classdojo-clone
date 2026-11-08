import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { LOGIN_PATTERN } from '../../platform/credentials.js';
import { parse } from '../../platform/errors.js';
import {
  adminTeachers, createTeacher, resetTeacherPassword, schoolInfo, setTeacherPremium, updateSchool,
} from './admin.service.js';
import { adminGroups, updateAdminGroup } from './school-groups.service.js';
import { deleteTeacher, setTeacherDisabled, transferTeacherGroups } from './teacher-admin.service.js';
import { changeOwnPassword } from './service.js';

export const TeacherBody = z.object({
  name: z.string().trim().min(1, 'Введите имя преподавателя').max(80),
  login: z.string().trim().toLowerCase().regex(LOGIN_PATTERN, 'Логин: 3–64 символа, латиница, цифры, точка или дефис'),
});
const SchoolBody = z
  .object({
    name: z.string().trim().min(1, 'Введите название').max(120).optional(),
    kind: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY'], { message: 'Выберите тип учреждения' }).optional(),
    heroes: z.boolean().optional(),
  })
  .refine((b) => b.name !== undefined || b.kind !== undefined || b.heroes !== undefined, 'Укажите, что изменить');
const PremiumBody = z.object({
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((key) => {
    const d = new Date(`${key}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key;
  }, 'Укажите существующую дату').nullable(),
});

const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');
const DisabledBody = z.object({ disabled: z.boolean() });
const TransferBody = z.object({ toTeacherId: z.string().min(1).max(64) });
const GroupBody = z.object({
  departmentId: z.string().min(1).nullable(),
  course: z.number().int().min(1, 'Курс от 1').max(11, 'Не больше 11').nullable(),
  specialty: z.string().trim().max(120).default(''),
});

/**
 * Администрация школы: всё в пределах своей школы, остальным ролям маршруты закрыты.
 * Смотреть может любой сотрудник, менять преподавателей — директор и завуч, название и тип учреждения — только директор
 */
export const adminRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .post('/me/password', async (c) => {
    await changeOwnPassword(c.get('user'), await c.req.json().catch(() => null));
    return c.json({ ok: true });
  })
  .get('/school', async (c) => c.json(await schoolInfo(c.get('user'))))
  .patch('/school', requireSchoolRole('DIRECTOR'), async (c) => {
    return c.json(await updateSchool(c.get('user'), parse(SchoolBody, await c.req.json().catch(() => null))));
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
  .put('/teachers/:id/disabled', MANAGERS, async (c) => {
    const { disabled } = parse(DisabledBody, await c.req.json().catch(() => null));
    await setTeacherDisabled(c.get('user').schoolId!, c.req.param('id'), disabled);
    return c.json(await adminTeachers(c.get('user').schoolId!));
  })
  .post('/teachers/:id/transfer', MANAGERS, async (c) => {
    const { toTeacherId } = parse(TransferBody, await c.req.json().catch(() => null));
    const { moved } = await transferTeacherGroups(c.get('user').schoolId!, c.req.param('id'), toTeacherId);
    return c.json({ moved, ...(await adminTeachers(c.get('user').schoolId!)) });
  })
  .delete('/teachers/:id', MANAGERS, async (c) => {
    await deleteTeacher(c.get('user').schoolId!, c.req.param('id'));
    return c.json(await adminTeachers(c.get('user').schoolId!));
  })
  .get('/groups', async (c) => c.json(await adminGroups(c.get('user'))))
  .patch('/groups/:id', async (c) => {
    const body = parse(GroupBody, await c.req.json().catch(() => null));
    return c.json(await updateAdminGroup(c.get('user'), c.req.param('id'), body));
  });
