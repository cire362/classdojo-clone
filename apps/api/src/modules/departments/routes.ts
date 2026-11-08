import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { createDepartment, deleteDepartment, schoolDepartments, updateDepartment } from './service.js';

const DepartmentBody = z.object({
  name: z.string().trim().min(1, 'Введите название').max(120),
  parentId: z.string().min(1).nullable().default(null),
});
const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');

/** Подразделения: видит вся администрация, меняют директор и заместитель всего учреждения */
export const adminDepartmentRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/departments', async (c) => c.json(await schoolDepartments(c.get('user').schoolId!)))
  .post('/departments', MANAGERS, async (c) => {
    const body = parse(DepartmentBody, await c.req.json().catch(() => null));
    return c.json(await createDepartment(c.get('user').schoolId!, body), 201);
  })
  .patch('/departments/:id', MANAGERS, async (c) => {
    const body = parse(DepartmentBody, await c.req.json().catch(() => null));
    return c.json(await updateDepartment(c.get('user').schoolId!, c.req.param('id'), body));
  })
  .delete('/departments/:id', MANAGERS, async (c) => c.json(await deleteDepartment(c.get('user').schoolId!, c.req.param('id'))));
