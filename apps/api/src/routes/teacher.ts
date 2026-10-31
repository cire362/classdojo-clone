import { Hono } from 'hono';
import { normalizeHero } from '@heroes/shared';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../platform/auth.js';
import { prisma } from '../platform/db.js';
import { env } from '../platform/env.js';
import { addDays, dateKey, dbDate, isDateKey, startOfDay } from '../platform/dates.js';
import { HttpError, notFound, parse } from '../platform/errors.js';
import { OWNER_ONLY_MESSAGE, groupsOf, teacherGroup, teacherStudent } from '../modules/access/index.js';
import { classGoal, goalRoutes } from '../modules/goals/index.js';
import { createDefaultRewards, pendingRequestCount, teacherRewardRoutes } from '../modules/rewards/index.js';
import { groupTeams, teamRoutes } from '../modules/teams/index.js';
import { teacherFeedRoutes } from '../modules/feed/index.js';
import { portfolioRoutes } from '../modules/portfolio/index.js';
import { teacherMessageRoutes } from '../modules/messages/index.js';
import { addCoTeacher, groupTeachers, removeCoTeacher } from '../services/coTeachers.js';
import { attendanceRoutes, todayAttendance } from '../modules/attendance/index.js';
import { cardSummaries, pointRoutes } from '../modules/points/index.js';
import { teacherPremium } from '../services/premium.js';
import { studentProfile } from '../services/profile.js';
import { createDefaultReasons, manualReasons, reasonRoutes } from '../modules/reasons/index.js';
import { groupStats, statsWorkbook } from '../services/stats.js';
import { weeklyStats } from '../services/weekly-stats.js';
import { studentReport } from '../services/student-report.js';
import { reportPdf } from '../services/report-pdf.js';
import { studentAdminRoutes } from '../modules/students/index.js';
import { deleteOrphanParents, teacherParentRoutes } from '../modules/parents/index.js';
import { changeOwnPassword } from '../services/password.js';
import { saveHero } from './student.js';

const id = z.string().min(1).max(64);
const GroupCreate = z.object({ name: z.string().trim().min(1, 'Введите название').max(60) });
const GroupPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  subtractTeacher: z.boolean().optional(),
});
const TeacherLogin = z.object({ login: z.string().trim().toLowerCase().min(1).max(64) });
const ProfileBody = z.object({ name: z.string().trim().min(1, 'Введите имя').max(80) });

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
    const [students, reasons, today] = await Promise.all([
      prisma.student.findMany({
        where: { groupId: group.id },
        orderBy: { name: 'asc' },
        include: { hero: true, account: { select: { login: true } }, _count: { select: { parents: true } } },
      }),
      manualReasons(group.id),
      todayAttendance(group.id),
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
      reasons,
      teams,
      classGoal: goal,
      pendingRewards,
      todayAttendance: today,
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
  .route('/', studentAdminRoutes)

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
  .route('/', teacherMessageRoutes)

  // ───── Родители ─────
  .route('/', teacherParentRoutes)

  .get('/students/:id/profile', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await studentProfile(student.id));
  })
  .put('/students/:id/hero', async (c) => {
    const student = await teacherStudent(c.get('user'), c.req.param('id'));
    return c.json(await saveHero(student.id, await c.req.json().catch(() => null)));
  })

  // ───── Причины ─────
  .route('/', reasonRoutes)

  // ───── Общая цель класса ─────
  .route('/', goalRoutes)

  // ───── Баллы ─────
  .route('/', pointRoutes)

  // ───── Посещаемость ─────
  .route('/', attendanceRoutes)

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
