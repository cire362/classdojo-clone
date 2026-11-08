import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { dateKey, isDateKey } from '../../platform/dates.js';
import { HttpError, parse } from '../../platform/errors.js';
import { MAX_LESSONS_PER_DAY, checkAttendanceDate } from '../attendance/index.js';
import {
  awardInStream,
  createStream,
  deleteStream,
  saveStreamAttendance,
  streamAttendance,
  streamBoard,
  teacherStreams,
  updateStream,
} from './service.js';

const id = z.string().min(1).max(64);
const StreamBody = z.object({
  name: z.string().trim().min(1, 'Введите название потока').max(80),
  groupIds: z.array(id).min(2, 'Выберите хотя бы две группы').max(30),
  subjectId: id.nullable().default(null),
});
const AwardBody = z.object({ studentIds: z.array(id).min(1).max(1000), reasonId: id });
const lessonNumber = z.coerce.number().int().min(1).max(MAX_LESSONS_PER_DAY);
const AttendanceBody = z.object({
  date: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
  lesson: lessonNumber.default(1),
  presentStudentIds: z.array(id).max(1000),
});

/** Потоки преподавателя: лекция для нескольких групп. Роль проверяет сборка routes/teacher.ts */
export const streamRoutes = new Hono<AppEnv>()
  .get('/streams', async (c) => c.json(await teacherStreams(c.get('user').teacherId!)))
  .post('/streams', async (c) => {
    const user = c.get('user');
    const body = parse(StreamBody, await c.req.json().catch(() => null));
    return c.json(await createStream(user.teacherId!, user.schoolId, body), 201);
  })
  .patch('/streams/:id', async (c) => {
    const user = c.get('user');
    const body = parse(StreamBody, await c.req.json().catch(() => null));
    return c.json(await updateStream(user.teacherId!, user.schoolId, c.req.param('id'), body));
  })
  .delete('/streams/:id', async (c) => c.json(await deleteStream(c.get('user').teacherId!, c.req.param('id'))))
  .get('/streams/:id', async (c) => c.json(await streamBoard(c.get('user').teacherId!, c.req.param('id'))))
  .post('/streams/:id/points', async (c) => {
    const user = c.get('user');
    const body = parse(AwardBody, await c.req.json().catch(() => null));
    return c.json(await awardInStream(user.teacherId!, user.accountId, c.req.param('id'), body.studentIds, body.reasonId), 201);
  })
  .get('/streams/:id/attendance', async (c) => {
    const date = c.req.query('date') ?? dateKey();
    if (!isDateKey(date)) throw new HttpError(400, 'Дата в формате ГГГГ-ММ-ДД');
    const lesson = parse(lessonNumber, c.req.query('lesson') ?? '1');
    return c.json(await streamAttendance(c.get('user').teacherId!, c.req.param('id'), date, lesson));
  })
  .post('/streams/:id/attendance', async (c) => {
    const user = c.get('user');
    const body = parse(AttendanceBody, await c.req.json().catch(() => null));
    const date = body.date ?? dateKey();
    checkAttendanceDate(date);
    const params = { date, lesson: body.lesson, presentStudentIds: body.presentStudentIds };
    return c.json(await saveStreamAttendance(user.teacherId!, user.accountId, c.req.param('id'), params), 201);
  });
