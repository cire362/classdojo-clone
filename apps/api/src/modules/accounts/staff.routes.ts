import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { TeacherBody } from './admin.routes.js';
import { approveTeacher, disableJoinCode, rejectTeacher, renewJoinCode, teacherRequests } from './join.service.js';
import { createStaff, removeStaff, resetStaffPassword, schoolStaff, setStaffDepartment, setStaffRole } from './staff.service.js';

const SchoolRoleField = z.enum(['DIRECTOR', 'DEPUTY', 'STAFF'], { message: 'Выберите должность' });
const StaffBody = TeacherBody.extend({ role: SchoolRoleField });
const RoleBody = z.object({ role: SchoolRoleField });
const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');
/** Должность директора проверяется и здесь, и ещё раз под блокировкой школы в сервисе */
const DIRECTOR = requireSchoolRole('DIRECTOR');

/**
 * Состав администрации и подключение преподавателей. Список администрации видит любой сотрудник,
 * меняет его директор; код школы и заявки — у директора и завуча
 */
export const schoolStaffRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/staff', async (c) => c.json(await schoolStaff(c.get('user'))))
  .post('/staff', DIRECTOR, async (c) => {
    const body = parse(StaffBody, await c.req.json().catch(() => null));
    return c.json(await createStaff(c.get('user'), body), 201);
  })
  .put('/staff/:id/role', DIRECTOR, async (c) => {
    const { role } = parse(RoleBody, await c.req.json().catch(() => null));
    return c.json(await setStaffRole(c.get('user'), c.req.param('id'), role));
  })
  .put('/staff/:id/department', DIRECTOR, async (c) => {
    const { departmentId } = parse(z.object({ departmentId: z.string().min(1).nullable() }), await c.req.json().catch(() => null));
    return c.json(await setStaffDepartment(c.get('user'), c.req.param('id'), departmentId));
  })
  .post('/staff/:id/reset-password', DIRECTOR, async (c) => c.json(await resetStaffPassword(c.get('user'), c.req.param('id'))))
  .delete('/staff/:id', DIRECTOR, async (c) => c.json(await removeStaff(c.get('user'), c.req.param('id'))))
  .post('/join-code', MANAGERS, async (c) => c.json({ joinCode: await renewJoinCode(c.get('user').schoolId!) }))
  .delete('/join-code', MANAGERS, async (c) => {
    await disableJoinCode(c.get('user').schoolId!);
    return c.json({ joinCode: null });
  })
  .get('/teacher-requests', MANAGERS, async (c) => c.json(await teacherRequests(c.get('user').schoolId!)))
  .post('/teacher-requests/:id/approve', MANAGERS, async (c) => c.json(await approveTeacher(c.get('user').schoolId!, c.req.param('id'))))
  .delete('/teacher-requests/:id', MANAGERS, async (c) => c.json(await rejectTeacher(c.get('user').schoolId!, c.req.param('id'))));
