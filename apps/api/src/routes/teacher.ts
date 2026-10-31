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
import { teacherProfileRoutes } from '../modules/profile/index.js';
import { createDefaultReasons, manualReasons, reasonRoutes } from '../modules/reasons/index.js';
import { teacherReportRoutes } from '../modules/reports/index.js';
import { teacherAccountRoutes } from '../modules/accounts/index.js';
import { teacherHeroRoutes } from '../modules/hero/index.js';
import { studentAdminRoutes } from '../modules/students/index.js';
import { deleteOrphanParents, teacherParentRoutes } from '../modules/parents/index.js';

const id = z.string().min(1).max(64);
const GroupCreate = z.object({ name: z.string().trim().min(1, 'Введите название').max(60) });
const GroupPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  subtractTeacher: z.boolean().optional(),
});
const TeacherLogin = z.object({ login: z.string().trim().toLowerCase().min(1).max(64) });

export const teacherRoutes = new Hono<AppEnv>()
  .use(requireRole('TEACHER'))

  // ───── Профиль преподавателя ─────
  .route('/', teacherAccountRoutes)

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

  .route('/', teacherProfileRoutes)
  .route('/', teacherHeroRoutes)

  // ───── Причины ─────
  .route('/', reasonRoutes)

  // ───── Общая цель класса ─────
  .route('/', goalRoutes)

  // ───── Баллы ─────
  .route('/', pointRoutes)

  // ───── Посещаемость ─────
  .route('/', attendanceRoutes)

  // ───── Статистика ─────
  .route('/', teacherReportRoutes);
