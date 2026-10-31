import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { dateKey, isDateKey } from '../../platform/dates.js';
import { env } from '../../platform/env.js';
import { HttpError, parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { countPeople } from './detector.js';
import { MAX_LESSONS_PER_DAY, attendanceForDate, checkAttendanceDate, deleteAttendance, saveAttendance } from './service.js';

const lessonNumber = z.coerce.number().int().min(1).max(MAX_LESSONS_PER_DAY);
const AttendanceBody = z.object({
  date: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
  lesson: lessonNumber.default(1),
  presentStudentIds: z.array(z.string().min(1).max(64)).max(200),
  peopleOnPhoto: z.number().int().min(0).max(500).nullable(),
  subtractedTeacher: z.boolean(),
});

/** Посещаемость группы. Роль проверяет сборка routes/teacher.ts */
export const attendanceRoutes = new Hono<AppEnv>()
  .post(
    '/groups/:id/attendance/detect',
    bodyLimit({
      maxSize: env.maxPhotoBytes,
      onError: () => {
        throw new HttpError(413, 'Фото слишком большое');
      },
    }),
    async (c) => {
      await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
      const body = await c.req.parseBody();
      const photo = body['photo'];
      if (!(photo instanceof File)) throw new HttpError(400, 'Загрузите фото');
      if (!photo.type.startsWith('image/')) throw new HttpError(415, 'Нужен файл изображения');
      // Фото не сохраняется: передаём его из памяти в сервис подсчёта и возвращаем только числа
      return c.json(await countPeople(photo));
    },
  )
  .get('/groups/:id/attendance', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const date = c.req.query('date') ?? dateKey();
    if (!isDateKey(date)) throw new HttpError(400, 'Дата в формате ГГГГ-ММ-ДД');
    const lessonRaw = c.req.query('lesson');
    const lesson = lessonRaw === undefined ? undefined : parse(lessonNumber, lessonRaw);
    return c.json(await attendanceForDate(group.id, date, lesson));
  })
  .delete('/groups/:id/attendance', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const date = c.req.query('date') ?? '';
    if (!isDateKey(date)) throw new HttpError(400, 'Дата в формате ГГГГ-ММ-ДД');
    await deleteAttendance(group.id, date, parse(lessonNumber, c.req.query('lesson')));
    return c.json({ ok: true });
  })
  .post('/groups/:id/attendance', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const body = parse(AttendanceBody, await c.req.json().catch(() => null));
    const date = body.date ?? dateKey();
    checkAttendanceDate(date);
    const result = await saveAttendance({
      groupId: group.id,
      date,
      lesson: body.lesson,
      presentStudentIds: body.presentStudentIds,
      peopleOnPhoto: body.peopleOnPhoto,
      subtractedTeacher: body.subtractedTeacher,
      createdById: c.get('user').accountId,
    });
    return c.json(result, 201);
  });
