import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { normalizeHero } from '@heroes/shared';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { prisma } from '../platform/db.js';
import { env } from '../platform/env.js';
import { addDays, dateKey, dbDate, isDateKey, startOfDay } from '../platform/dates.js';
import { HttpError, notFound, parse } from '../platform/errors.js';
import { ARCHIVED_MESSAGE, OWNER_ONLY_MESSAGE, groupsOf, teacherGroup, teacherStudent } from '../modules/access/index.js';
import { classGoal, goalRoutes } from '../modules/goals/index.js';
import { createDefaultRewards, pendingRequestCount, teacherRewardRoutes } from '../modules/rewards/index.js';
import { groupTeams, teamRoutes } from '../modules/teams/index.js';
import { teacherFeedRoutes } from '../modules/feed/index.js';
import { portfolioRoutes } from '../modules/portfolio/index.js';
import { MAX_MESSAGE_LENGTH, sendMessage, teacherThread, teacherThreads, threadMessages } from '../services/messages.js';
import { addCoTeacher, groupTeachers, removeCoTeacher } from '../services/coTeachers.js';
import { MAX_LESSONS_PER_DAY, attendanceForDate, deleteAttendance, saveAttendance } from '../services/attendance.js';
import { countPeople } from '../services/detector.js';
import { awardPoints, cardSummaries, deletePointEvents } from '../services/points.js';
import { teacherPremium } from '../services/premium.js';
import { studentProfile } from '../services/profile.js';
import { createDefaultReasons } from '../services/reasons.js';
import { groupStats, statsWorkbook } from '../services/stats.js';
import { weeklyStats } from '../services/weekly-stats.js';
import { studentReport } from '../services/student-report.js';
import { reportPdf } from '../services/report-pdf.js';
import { MAX_IMPORT_BYTES, previewImport } from '../services/import.js';
import { createParents, deleteOrphanParents, linkParent, resetParentPassword, studentParents, unlinkParent } from '../services/parents.js';
import { createStudents, deleteStudent, resetStudentPassword } from '../services/students.js';
import { changeOwnPassword } from '../services/password.js';
import { saveHero } from './student.js';

const id = z.string().min(1).max(64);
const reasonView = (r: { id: string; name: string; emoji: string; value: number; countsForHelpBadge: boolean }) => ({
  id: r.id, name: r.name, emoji: r.emoji, value: r.value, countsForHelpBadge: r.countsForHelpBadge,
});
const GroupCreate = z.object({ name: z.string().trim().min(1, 'Введите название').max(60) });
const GroupPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  subtractTeacher: z.boolean().optional(),
});
const StudentsCreate = z.object({
  names: z.array(z.string().trim().max(80)).min(1).max(100),
});
const MessageBody = z.object({ text: z.string().trim().min(1, 'Напишите сообщение').max(MAX_MESSAGE_LENGTH) });
const TeacherLogin = z.object({ login: z.string().trim().toLowerCase().min(1).max(64) });
const ParentLink = z.object({ login: z.string().trim().min(1).max(64) });
const StudentPatch = z.object({ name: z.string().trim().min(1).max(80) });
const ResetMany = z.object({ studentIds: z.array(id).max(200).optional() });
const ReasonBody = z.object({
  countsForHelpBadge: z.boolean().optional(),
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
const ProfileBody = z.object({ name: z.string().trim().min(1, 'Введите имя').max(80) });
const lessonNumber = z.coerce.number().int().min(1).max(MAX_LESSONS_PER_DAY);
const AttendanceBody = z.object({
  date: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД').optional(),
  lesson: lessonNumber.default(1),
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

  // ───── Профиль преподавателя ─────
  .get('/plan', async (c) => c.json(await teacherPremium(c.get('user').teacherId!)))
  .patch('/me', async (c) => {
    const { name } = parse(ProfileBody, await c.req.json().catch(() => null));
    const t = await prisma.teacher.update({ where: { id: c.get('user').teacherId! }, data: { name } });
    return c.json({ name: t.name });
  })
  .post('/me/password', async (c) => {
    await changeOwnPassword(c.get('user'), await c.req.json().catch(() => null));
    return c.json({ ok: true });
  })

  // ───── Группы ─────
  .get('/groups', async (c) => {
    const groups = await prisma.group.findMany({
      where: groupsOf(c.get('user').teacherId!),
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { students: true } },
        students: { take: 6, orderBy: { name: 'asc' }, select: { hero: { select: { parts: true } } } },
        teacher: { select: { name: true } },
        coTeachers: { orderBy: { createdAt: 'asc' }, select: { teacher: { select: { id: true, name: true } } } },
      },
    });
    const me = c.get('user').teacherId!;
    return c.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        subtractTeacher: g.subtractTeacher,
        archivedAt: g.archivedAt,
        studentsCount: g._count.students,
        previewHeroes: g.students.map((s) => normalizeHero(s.hero?.parts)),
        isOwner: g.teacherId === me,
        // Другие преподаватели группы — подпись «вместе с …» на карточке
        colleagues: [
          ...(g.teacherId === me ? [] : [g.teacher.name]),
          ...g.coTeachers.filter((ct) => ct.teacher.id !== me).map((ct) => ct.teacher.name),
        ],
      })),
    );
  })
  .post('/groups', async (c) => {
    const { name } = parse(GroupCreate, await c.req.json().catch(() => null));
    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.group.create({ data: { name, teacherId: c.get('user').teacherId! } });
      await createDefaultReasons(tx, g.id);
      await createDefaultRewards(tx, g.id);
      return g;
    });
    return c.json(
      { id: group.id, name: group.name, subtractTeacher: group.subtractTeacher, archivedAt: null, studentsCount: 0, previewHeroes: [] },
      201,
    );
  })
  .get('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const [students, reasons, todaySession] = await Promise.all([
      prisma.student.findMany({
        where: { groupId: group.id },
        orderBy: { name: 'asc' },
        include: { hero: true, account: { select: { login: true } }, _count: { select: { parents: true } } },
      }),
      prisma.behaviorReason.findMany({
        where: { groupId: group.id, kind: 'MANUAL', archived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      // «Сегодня» на экране урока — последний отмеченный сегодня урок
      prisma.attendanceSession.findFirst({
        where: { groupId: group.id, date: dbDate(dateKey()) },
        orderBy: { lessonNumber: 'desc' },
        include: { records: true },
      }),
    ]);
    const [summaries, teams, pendingRewards, goal] = await Promise.all([
      cardSummaries(students.map((s) => s.id)),
      groupTeams(group.id),
      pendingRequestCount(group.id),
      classGoal(group.id),
    ]);
    return c.json({
      group: { id: group.id, name: group.name, subtractTeacher: group.subtractTeacher, archivedAt: group.archivedAt, isOwner: group.isOwner },
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        login: s.account.login,
        hero: { name: s.hero?.name ?? '', parts: normalizeHero(s.hero?.parts) },
        parentsCount: s._count.parents,
        teamId: s.teamId,
        ...summaries.get(s.id)!,
      })),
      reasons: reasons.map(reasonView),
      teams,
      classGoal: goal,
      pendingRewards,
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
    if (data.name !== undefined && data.name !== group.name && !group.isOwner) throw new HttpError(403, OWNER_ONLY_MESSAGE);
    const g = await prisma.group.update({ where: { id: group.id }, data });
    return c.json({ id: g.id, name: g.name, subtractTeacher: g.subtractTeacher });
  })
  // Архив: группа скрывается из списка и замораживается (просмотр, статистика и Excel остаются)
  .post('/groups/:id/archive', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    const g = await prisma.group.update({ where: { id: group.id }, data: { archivedAt: group.archivedAt ?? new Date() } });
    return c.json({ id: g.id, archivedAt: g.archivedAt });
  })
  .post('/groups/:id/restore', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    await prisma.group.update({ where: { id: group.id }, data: { archivedAt: null } });
    return c.json({ id: group.id, archivedAt: null });
  })
  .delete('/groups/:id', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    const students = await prisma.student.findMany({ where: { groupId: group.id }, select: { accountId: true } });
    await prisma.$transaction([
      prisma.account.deleteMany({ where: { id: { in: students.map((s) => s.accountId) } } }),
      prisma.group.delete({ where: { id: group.id } }),
      deleteOrphanParents(),
    ]);
    return c.json({ ok: true });
  })

  // ───── Ученики ─────
  .post('/groups/:id/students', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { names } = parse(StudentsCreate, await c.req.json().catch(() => null));
    const clean = names.filter(Boolean);
    if (!clean.length) throw new HttpError(400, 'Введите хотя бы одно имя');
    const total = await prisma.student.count({ where: { groupId: group.id } });
    if (total + clean.length > 200) throw new HttpError(400, 'В группе может быть не больше 200 учеников');
    return c.json({ credentials: await createStudents(group.id, clean) }, 201);
  })
  // Разбор Excel/CSV со списком учеников: только предпросмотр, создание — обычным POST /students
  .post(
    '/groups/:id/students/import-preview',
    bodyLimit({
      maxSize: MAX_IMPORT_BYTES + 64 * 1024,
      onError: () => {
        throw new HttpError(413, 'Файл слишком большой (больше 2 МБ)');
      },
    }),
    async (c) => {
      const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!(file instanceof File)) throw new HttpError(400, 'Загрузите файл');
      const preview = await previewImport(file);
      const existing = await prisma.student.findMany({ where: { groupId: group.id }, select: { name: true } });
      const have = new Set(existing.map((s) => s.name.toLowerCase()));
      return c.json({
        ...preview,
        names: preview.names.map((name) => ({ name, alreadyInGroup: have.has(name.toLowerCase()) })),
      });
    },
  )
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
  // Перевод в другую группу этого же преподавателя: герой, баллы, история и логин остаются при ученике,
  // прошлые отметки посещаемости остаются в старой группе
  .post('/students/:id/move', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    const { groupId } = parse(z.object({ groupId: id }), await c.req.json().catch(() => null));
    const target = await teacherGroup(c.get('user'), groupId, { writable: true });
    if (target.id === student.groupId) throw new HttpError(400, 'Ученик уже в этой группе');
    const total = await prisma.student.count({ where: { groupId: target.id } });
    if (total >= 200) throw new HttpError(400, 'В группе может быть не больше 200 учеников');
    // Команды принадлежат группе: в новой ученик начинает без команды
    await prisma.student.update({ where: { id: student.id }, data: { groupId: target.id, teamId: null } });
    return c.json({ id: student.id, groupId: target.id, groupName: target.name });
  })
  .post('/students/:id/reset-password', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await resetStudentPassword(student.id));
  })

  // ───── Преподаватели группы ─────
  .get('/groups/:id/teachers', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    return c.json(await groupTeachers(group.id, c.get('user').teacherId!));
  })
  .post('/groups/:id/teachers', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { owner: true });
    const { login } = parse(TeacherLogin, await c.req.json().catch(() => null));
    await addCoTeacher(group, login);
    return c.json(await groupTeachers(group.id, c.get('user').teacherId!));
  })
  /** Владелец убирает соавтора; соавтор может убрать только себя (выйти из группы) */
  .delete('/groups/:id/teachers/:teacherId', async (c) => {
    const user = c.get('user');
    const group = await teacherGroup(user, c.req.param('id'));
    const teacherId = c.req.param('teacherId');
    if (!group.isOwner && teacherId !== user.teacherId) throw new HttpError(403, OWNER_ONLY_MESSAGE);
    await removeCoTeacher(group.id, teacherId);
    return c.json({ ok: true });
  })

  // ───── Портфолио ─────
  .route('/', portfolioRoutes)

  // ───── Магазин наград ─────
  .route('/', teacherRewardRoutes)

  // ───── Команды ─────
  .route('/', teamRoutes)

  // ───── Лента класса ─────
  .route('/', teacherFeedRoutes)

  // ───── Сообщения родителям ─────
  .get('/messages', async (c) => c.json(await teacherThreads(c.get('user').teacherId!, c.get('user').accountId)))
  .get('/students/:id/parents/:parentId/messages', async (c) => {
    const user = c.get('user');
    const thread = await teacherThread(user.teacherId!, c.req.param('id'), c.req.param('parentId'));
    return c.json({ ...thread, messages: await threadMessages(c.req.param('id'), c.req.param('parentId'), user.accountId) });
  })
  .post('/students/:id/parents/:parentId/messages', async (c) => {
    const user = c.get('user');
    await teacherThread(user.teacherId!, c.req.param('id'), c.req.param('parentId'));
    const { text } = parse(MessageBody, await c.req.json().catch(() => null));
    return c.json(await sendMessage(c.req.param('id'), c.req.param('parentId'), user.accountId, text), 201);
  })

  // ───── Родители ─────
  .get('/students/:id/parents', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await studentParents(student.id));
  })
  .post('/students/:id/parents', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    if (student.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
    if ((await prisma.parentStudent.count({ where: { studentId: student.id } })) >= 4) {
      throw new HttpError(400, 'У ученика может быть не больше 4 родительских входов');
    }
    const [credentials] = await createParents([{ id: student.id, name: student.name }]);
    return c.json(credentials);
  })
  .post('/students/:id/parents/link', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    if (student.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
    const { login } = parse(ParentLink, await c.req.json().catch(() => null));
    await linkParent(user.teacherId!, student.id, login);
    return c.json(await studentParents(student.id));
  })
  .delete('/students/:id/parents/:parentId', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    await unlinkParent(user.teacherId!, student.id, c.req.param('parentId'));
    return c.json(await studentParents(student.id));
  })
  .post('/students/:id/parents/:parentId/reset-password', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    return c.json(await resetParentPassword(user.teacherId!, c.req.param('parentId'), student.id));
  })
  /** Доступ родителям всех учеников группы, у кого его ещё нет, — для листа на родительское собрание */
  .post('/groups/:id/parents', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const students = await prisma.student.findMany({
      where: { groupId: group.id, parents: { none: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return c.json({ credentials: await createParents(students) });
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
    return c.json(reasons.map(reasonView));
  })
  .post('/groups/:id/reasons', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const body = parse(ReasonBody, await c.req.json().catch(() => null));
    const max = await prisma.behaviorReason.aggregate({
      where: { groupId: group.id, kind: 'MANUAL' },
      _max: { sortOrder: true },
    });
    const r = await prisma.behaviorReason.create({
      data: { ...body, groupId: group.id, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    return c.json(reasonView(r), 201);
  })
  // Новый порядок причин: полный список активных причин группы в нужном порядке
  .put('/groups/:id/reasons/order', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const { reasonIds } = parse(z.object({ reasonIds: z.array(id).min(1).max(200) }), await c.req.json().catch(() => null));
    const active = await prisma.behaviorReason.findMany({
      where: { groupId: group.id, kind: 'MANUAL', archived: false },
      select: { id: true },
    });
    const activeIds = new Set(active.map((r) => r.id));
    if (new Set(reasonIds).size !== reasonIds.length || reasonIds.length !== activeIds.size || reasonIds.some((r) => !activeIds.has(r))) {
      throw new HttpError(409, 'Список причин изменился, обновите страницу');
    }
    await prisma.$transaction(
      reasonIds.map((rid, i) => prisma.behaviorReason.update({ where: { id: rid }, data: { sortOrder: i } })),
    );
    return c.json({ ok: true });
  })
  .patch('/reasons/:id', async (c) => {
    const reason = await ownedReason(c.get('user').teacherId!, c.req.param('id'));
    const body = parse(ReasonBody, await c.req.json().catch(() => null));
    const r = await prisma.behaviorReason.update({ where: { id: reason.id }, data: body });
    return c.json(reasonView(r));
  })
  .delete('/reasons/:id', async (c) => {
    const reason = await ownedReason(c.get('user').teacherId!, c.req.param('id'));
    // Архивируем: в истории начислений остаются название и эмодзи
    await prisma.behaviorReason.update({ where: { id: reason.id }, data: { archived: true } });
    return c.json({ ok: true });
  })

  // ───── Общая цель класса ─────
  .route('/', goalRoutes)

  // ───── Баллы ─────
  .post('/groups/:id/points', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
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
        classGoal: await classGoal(group.id),
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
      lesson: body.lesson ?? 1,
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
  .get('/students/:id/report.pdf', async (c) => {
    const user = c.get('user');
    const student = await teacherStudent(user, c.req.param('id'));
    const query = parse(z.object({ from: z.string().optional(), to: z.string().optional() }), c.req.query());
    const report = await studentReport(student.id, user.teacherId!, query);
    const pdf = await reportPdf(report);
    const name = `Отчёт ${student.name.replace(/[\u0000-\u001f/\\]/g, ' ')} ${report.from}_${report.to}.pdf`;
    const encoded = encodeURIComponent(name).replace(/['()*]/g, (s) => `%${s.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(new Uint8Array(pdf), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="student-report.pdf"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  })
  .get('/groups/:id/stats/weekly', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'));
    const query = parse(z.object({ from: z.string().optional(), to: z.string().optional(), studentId: id.optional(), teamId: id.optional() }), c.req.query());
    return c.json(await weeklyStats(group.id, query));
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
    where: { id: reasonId, kind: 'MANUAL', archived: false, group: groupsOf(teacherId) },
    include: { group: { select: { archivedAt: true } } },
  });
  if (!reason) throw notFound('Причина не найдена');
  if (reason.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
  return reason;
}
