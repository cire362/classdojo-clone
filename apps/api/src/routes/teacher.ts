import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { normalizeHero } from '@heroes/shared';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { addDays, dateKey, dbDate, isDateKey, startOfDay } from '../lib/dates.js';
import { HttpError, notFound, parse } from '../lib/errors.js';
import { teacherGroup, teacherStudent } from '../services/access.js';
import { attendanceForDate, saveAttendance } from '../services/attendance.js';
import { countPeople } from '../services/detector.js';
import { awardPoints, cardSummaries, deletePointEvents } from '../services/points.js';
import { studentProfile } from '../services/profile.js';
import { createDefaultReasons } from '../services/reasons.js';
import { groupStats, statsWorkbook } from '../services/stats.js';
import { createStudents, deleteStudent, resetStudentPassword } from '../services/students.js';
import { saveHero } from './student.js';

const id = z.string().min(1).max(64);
const GroupCreate = z.object({ name: z.string().trim().min(1, 'Введите название').max(60) });
const GroupPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  subtractTeacher: z.boolean().optional(),
});
const StudentsCreate = z.object({
  names: z.array(z.string().trim().max(80)).min(1).max(100),
});
const StudentPatch = z.object({ name: z.string().trim().min(1).max(80) });
const ResetMany = z.object({ studentIds: z.array(id).max(200).optional() });
const ReasonBody = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(16),
  value: z
    .number()
    .int()
    .min(-10)
    .max(10)
    .refine((v) => v !== 0, 'Значение не может быть нулём'),
});
const AwardBody = z.object({ studentIds: z.array(id).min(1).max(200), reasonId: id });
const AttendanceBody = z.object({
  date: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
  presentStudentIds: z.array(id).max(200),
  peopleOnPhoto: z.number().int().min(0).max(500).nullable(),
  subtractedTeacher: z.boolean(),
});

function period(q: Record<string, string | undefined>) {
  const today = new Date();
  const from = q.from && isDateKey(q.from) ? q.from : dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = q.to && isDateKey(q.to) ? q.to : dateKey(today);
  if (from > to) throw new HttpError(400, 'Начало периода позже конца');
  return { from, to };
}

export const teacherRoutes = new Hono<AppEnv>()
  .use(requireRole('TEACHER'))

  // ───── Группы ─────
  .get('/groups', async (c) => {
    const groups = await prisma.group.findMany({
      where: { teacherId: c.get('user').teacherId! },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { students: true } },
        students: { take: 6, orderBy: { name: 'asc' }, select: { hero: { select: { parts: true } } } },
      },
    });
    return c.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        subtractTeacher: g.subtractTeacher,
        studentsCount: g._count.students,
        previewHeroes: g.students.map((s) => normalizeHero(s.hero?.parts)),
      })),
    );
  })
  .post('/groups', async (c) => {
    const { name } = parse(GroupCreate, await c.req.json().catch(() => null));
    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.group.create({ data: { name, teacherId: c.get('user').teacherId! } });
      await createDefaultReasons(tx, g.id);
      return g;
    });
    return c.json(
      { id: group.id, name: group.name, subtractTeacher: group.subtractTeacher, studentsCount: 0, previewHeroes: [] },
      201,
    );
  })
  .get('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const [students, reasons, todaySession] = await Promise.all([
      prisma.student.findMany({
        where: { groupId: group.id },
        orderBy: { name: 'asc' },
        include: { hero: true, account: { select: { login: true } } },
      }),
      prisma.behaviorReason.findMany({
        where: { groupId: group.id, kind: 'MANUAL', archived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.attendanceSession.findUnique({
        where: { groupId_date: { groupId: group.id, date: dbDate(dateKey()) } },
        include: { records: true },
      }),
    ]);
    const summaries = await cardSummaries(students.map((s) => s.id));
    return c.json({
      group: { id: group.id, name: group.name, subtractTeacher: group.subtractTeacher },
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        login: s.account.login,
        hero: { name: s.hero?.name ?? '', parts: normalizeHero(s.hero?.parts) },
        ...summaries.get(s.id)!,
      })),
      reasons: reasons.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, value: r.value })),
      todayAttendance: todaySession
        ? {
            peopleOnPhoto: todaySession.peopleOnPhoto,
            presentStudentIds: todaySession.records.filter((r) => r.present).map((r) => r.studentId),
          }
        : null,
    });
  })
  .patch('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const data = parse(GroupPatch, await c.req.json().catch(() => null));
    const g = await prisma.group.update({ where: { id: group.id }, data });
    return c.json({ id: g.id, name: g.name, subtractTeacher: g.subtractTeacher });
  })
  .delete('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const students = await prisma.student.findMany({ where: { groupId: group.id }, select: { accountId: true } });
    await prisma.$transaction([
      prisma.account.deleteMany({ where: { id: { in: students.map((s) => s.accountId) } } }),
      prisma.group.delete({ where: { id: group.id } }),
    ]);
    return c.json({ ok: true });
  })

  // ───── Ученики ─────
  .post('/groups/:id/students', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { names } = parse(StudentsCreate, await c.req.json().catch(() => null));
    const clean = names.filter(Boolean);
    if (!clean.length) throw new HttpError(400, 'Введите хотя бы одно имя');
    const total = await prisma.student.count({ where: { groupId: group.id } });
    if (total + clean.length > 200) throw new HttpError(400, 'В группе может быть не больше 200 учеников');
    return c.json({ credentials: await createStudents(group.id, clean) }, 201);
  })
  .post('/groups/:id/reset-passwords', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { studentIds } = parse(ResetMany, await c.req.json().catch(() => ({})));
    const students = await prisma.student.findMany({
      where: { groupId: group.id, ...(studentIds ? { id: { in: studentIds } } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    const credentials = [];
    for (const s of students) credentials.push(await resetStudentPassword(s.id));
    return c.json({ credentials });
  })
  .patch('/students/:id', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    const { name } = parse(StudentPatch, await c.req.json().catch(() => null));
    const s = await prisma.student.update({ where: { id: student.id }, data: { name } });
    return c.json({ id: s.id, name: s.name });
  })
  .delete('/students/:id', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    await deleteStudent(student.id);
    return c.json({ ok: true });
  })
  .post('/students/:id/reset-password', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await resetStudentPassword(student.id));
  })
  .get('/students/:id/profile', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await studentProfile(student.id));
  })
  .put('/students/:id/hero', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await saveHero(student.id, await c.req.json().catch(() => null)));
  })

  // ───── Причины ─────
  .get('/groups/:id/reasons', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const reasons = await prisma.behaviorReason.findMany({
      where: { groupId: group.id, kind: 'MANUAL', archived: false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return c.json(reasons.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, value: r.value })));
  })
  .post('/groups/:id/reasons', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const body = parse(ReasonBody, await c.req.json().catch(() => null));
    const max = await prisma.behaviorReason.aggregate({
      where: { groupId: group.id, kind: 'MANUAL' },
      _max: { sortOrder: true },
    });
    const r = await prisma.behaviorReason.create({
      data: { ...body, groupId: group.id, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    return c.json({ id: r.id, name: r.name, emoji: r.emoji, value: r.value }, 201);
  })
  .patch('/reasons/:id', async (c) => {
    const reason = await ownedReason(c.get('user').teacherId!, c.req.param('id'));
    const body = parse(ReasonBody, await c.req.json().catch(() => null));
    const r = await prisma.behaviorReason.update({ where: { id: reason.id }, data: body });
    return c.json({ id: r.id, name: r.name, emoji: r.emoji, value: r.value });
  })
  .delete('/reasons/:id', async (c) => {
    const reason = await ownedReason(c.get('user').teacherId!, c.req.param('id'));
    // Архивируем: в истории начислений остаются название и эмодзи
    await prisma.behaviorReason.update({ where: { id: reason.id }, data: { archived: true } });
    return c.json({ ok: true });
  })

  // ───── Баллы ─────
  .post('/groups/:id/points', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const body = parse(AwardBody, await c.req.json().catch(() => null));
    const { reason, events } = await awardPoints({
      groupId: group.id,
      studentIds: body.studentIds,
      reasonId: body.reasonId,
      awardedById: c.get('user').accountId,
    });
    const summaries = await cardSummaries(body.studentIds);
    return c.json(
      {
        value: reason.value,
        eventIds: events.map((e) => e.id),
        summaries: Object.fromEntries(summaries),
      },
      201,
    );
  })
  .post('/points/undo', async (c) => {
    const { eventIds } = parse(z.object({ eventIds: z.array(id).min(1).max(200) }), await c.req.json().catch(() => null));
    const summaries = await deletePointEvents(c.get('user').teacherId!, eventIds);
    return c.json({ summaries: Object.fromEntries(summaries) });
  })
  // Удаление ошибочной записи из истории ученика
  .delete('/points/:id', async (c) => {
    const summaries = await deletePointEvents(c.get('user').teacherId!, [c.req.param('id')]);
    return c.json({ summaries: Object.fromEntries(summaries) });
  })

  // ───── Посещаемость ─────
  .post(
    '/groups/:id/attendance/detect',
    bodyLimit({
      maxSize: env.maxPhotoBytes,
      onError: () => {
        throw new HttpError(413, 'Фото слишком большое');
      },
    }),
    async (c) => {
      await teacherGroup(c.get('user'), c.req.param('id'));
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
    return c.json(await attendanceForDate(group.id, date));
  })
  .post('/groups/:id/attendance', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const body = parse(AttendanceBody, await c.req.json().catch(() => null));
    const date = body.date ?? dateKey();
    checkAttendanceDate(date);
    const result = await saveAttendance({
      groupId: group.id,
      date,
      presentStudentIds: body.presentStudentIds,
      peopleOnPhoto: body.peopleOnPhoto,
      subtractedTeacher: body.subtractedTeacher,
      createdById: c.get('user').accountId,
    });
    return c.json(result, 201);
  })

  // ───── Статистика ─────
  .get('/groups/:id/stats', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { from, to } = period(c.req.query());
    return c.json(await groupStats(group.id, from, to));
  })
  .get('/groups/:id/stats.xlsx', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const { from, to } = period(c.req.query());
    const buf = await statsWorkbook(group.id, group.name, from, to);
    const filename = `Статистика ${group.name} ${from}_${to}.xlsx`;
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stats.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  });

/** Отмечать можно сегодня и задним числом, но не в будущем и не старше года */
function checkAttendanceDate(date: string) {
  if (date > dateKey()) throw new HttpError(400, 'Нельзя отметить посещаемость в будущем');
  if (date < dateKey(addDays(startOfDay(), -366))) throw new HttpError(400, 'Можно отметить посещаемость не старше года');
}

async function ownedReason(teacherId: string, reasonId: string) {
  const reason = await prisma.behaviorReason.findFirst({
    where: { id: reasonId, kind: 'MANUAL', archived: false, group: { teacherId } },
  });
  if (!reason) throw notFound('Причина не найдена');
  return reason;
}
