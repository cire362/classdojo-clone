import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../../platform/auth.js';
import { env } from '../../platform/env.js';
import { HttpError, parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { decideAnswer } from './answers.service.js';
import { AssignmentBody, DecisionBody } from './schemas.js';
import { MAX_ASSIGNMENT_FILES, assignmentDetail, createAssignment, deleteAssignment, groupAssignments } from './service.js';

/** Все файлы предельного размера и запас на служебные части запроса: точные пределы проверяет сервис */
const limit = bodyLimit({
  maxSize: MAX_ASSIGNMENT_FILES * env.maxFileBytes + 1024 * 1024,
  onError: () => {
    throw new HttpError(413, 'Файлы слишком большие');
  },
});

/** Задания группы. Выдать новое можно только в действующей группе. Роль проверяет routes/teacher.ts */
export const teacherAssignmentRoutes = new Hono<AppEnv>()
  .get('/groups/:id/assignments', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await groupAssignments(group.id));
  })
  /** multipart: title, description, dueOn, points, target, teamId, studentId (несколько), file (несколько) */
  .post('/groups/:id/assignments', limit, async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'), { writable: true });
    const body = await c.req.parseBody({ all: true }).catch(() => {
      throw new HttpError(400, 'Задание отправляется формой');
    });
    const field = (name: string) => (typeof body[name] === 'string' && body[name] !== '' ? (body[name] as string) : undefined);
    const many = (name: string) => [body[name] ?? []].flat();
    const input = parse(AssignmentBody, {
      title: field('title'),
      description: field('description'),
      dueOn: field('dueOn'),
      points: field('points'),
      target: field('target'),
      teamId: field('teamId'),
      studentIds: many('studentId').filter((v): v is string => typeof v === 'string'),
    });
    const files = many('file').filter((f): f is File => f instanceof File);
    return c.json(await createAssignment(group.id, user.accountId, input, files), 201);
  })
  .get('/groups/:id/assignments/:assignmentId', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await assignmentDetail(group.id, c.req.param('assignmentId')));
  })
  .put('/groups/:id/assignments/:assignmentId/answers/:workId', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'));
    const decision = parse(DecisionBody, await c.req.json().catch(() => null));
    return c.json(await decideAnswer(group.id, user.accountId, c.req.param('assignmentId'), c.req.param('workId'), decision));
  })
  .delete('/groups/:id/assignments/:assignmentId', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await deleteAssignment(group.id, c.req.param('assignmentId')));
  });
