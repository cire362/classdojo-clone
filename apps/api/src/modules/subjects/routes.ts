import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { isDateKey } from '../../platform/dates.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import {
  addSubject, deleteSubject, groupSubjects, removeGroupSubject, renameSubject, schoolSubjects, schoolTeachers, setGroupSubject,
  subjectSummary,
} from './service.js';

const NameBody = z.object({ name: z.string().trim().min(1, 'Введите название').max(120) });
const GroupSubjectBody = z.object({ subjectId: z.string().min(1), teacherId: z.string().min(1) });
const Period = z.object({
  from: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД'),
  to: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД'),
});
const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');

/** Каталог дисциплин в панели учреждения: видит вся администрация, меняют директор и заместитель */
export const adminSubjectRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/subjects', async (c) => c.json(await schoolSubjects(c.get('user').schoolId!)))
  .post('/subjects', MANAGERS, async (c) => {
    const { name } = parse(NameBody, await c.req.json().catch(() => null));
    return c.json(await addSubject(c.get('user').schoolId!, name), 201);
  })
  .patch('/subjects/:id', MANAGERS, async (c) => {
    const { name } = parse(NameBody, await c.req.json().catch(() => null));
    return c.json(await renameSubject(c.get('user').schoolId!, c.req.param('id'), name));
  })
  .delete('/subjects/:id', MANAGERS, async (c) => c.json(await deleteSubject(c.get('user').schoolId!, c.req.param('id'))));

/** Дисциплины у преподавателя: каталог пополняет любой, дисциплины группы назначает её создатель. Роль — routes/teacher.ts */
export const teacherSubjectRoutes = new Hono<AppEnv>()
  .get('/subjects', async (c) => c.json(await schoolSubjects(c.get('user').schoolId!)))
  .post('/subjects', async (c) => {
    const { name } = parse(NameBody, await c.req.json().catch(() => null));
    return c.json(await addSubject(c.get('user').schoolId!, name), 201);
  })
  .get('/school-teachers', async (c) => c.json(await schoolTeachers(c.get('user').schoolId!)))
  .get('/groups/:id/subjects', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await groupSubjects(group.id));
  })
  .post('/groups/:id/subjects', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true, writable: true });
    const { subjectId, teacherId } = parse(GroupSubjectBody, await c.req.json().catch(() => null));
    return c.json(await setGroupSubject(group, subjectId, teacherId), 201);
  })
  .delete('/groups/:id/subjects/:subjectLinkId', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true, writable: true });
    return c.json(await removeGroupSubject(group.id, c.req.param('subjectLinkId')));
  })
  .get('/groups/:id/subjects/summary', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { from, to } = parse(Period, { from: c.req.query('from'), to: c.req.query('to') });
    return c.json(await subjectSummary(group.id, from, to));
  });
