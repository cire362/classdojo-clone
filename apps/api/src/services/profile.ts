import { levelForPoints, normalizeHero } from '@heroes/shared';
import { prisma } from '../db.js';
import { studentBadges } from './badges.js';
import { isActive } from './premium.js';
import { dbDateKey, startOfDay, startOfWeek } from '../lib/dates.js';

async function sums(studentId: string, since?: Date) {
  const base = { studentId, ...(since ? { createdAt: { gte: since } } : {}) };
  const [plus, minus] = await Promise.all([
    prisma.pointEvent.aggregate({ where: { ...base, value: { gt: 0 } }, _sum: { value: true } }),
    prisma.pointEvent.aggregate({ where: { ...base, value: { lt: 0 } }, _sum: { value: true } }),
  ]);
  const earned = plus._sum.value ?? 0;
  const lost = -(minus._sum.value ?? 0);
  return { earned, lost, net: earned - lost };
}

/** Полный профиль ученика — для его кабинета и для просмотра преподавателем */
export async function studentProfile(studentId: string) {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      account: { select: { login: true } },
      group: { select: { id: true, name: true, archivedAt: true, teacher: { select: { premiumUntil: true } } } },
      hero: true,
    },
  });
  const [today, week, total, history, attendance, portfolio] = await Promise.all([
    sums(studentId, startOfDay()),
    sums(studentId, startOfWeek()),
    sums(studentId),
    prisma.pointEvent.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true, value: true, reasonName: true, emoji: true, createdAt: true, attendanceSessionId: true,
        awardedBy: { select: { teacher: { select: { name: true } } } },
      },
    }),
    prisma.attendance.findMany({
      where: { studentId },
      include: { session: { select: { date: true, lessonNumber: true, createdAt: true } } },
      orderBy: [{ session: { date: 'desc' } }, { session: { lessonNumber: 'desc' } }],
    }),
    prisma.portfolioItem.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, description: true, emoji: true, createdAt: true, createdBy: { select: { teacher: { select: { name: true } } } } },
    }),
  ]);
  const attended = attendance.filter((a) => a.present).length;
  return {
    student: {
      id: student.id,
      name: student.name,
      login: student.account.login,
      group: { id: student.group.id, name: student.group.name, archivedAt: student.group.archivedAt },
    },
    /** Открыта ли премиум-коллекция деталей (премиум у создателя группы) */
    premium: isActive(student.group.teacher.premiumUntil),
    hero: { name: student.hero?.name ?? '', parts: normalizeHero(student.hero?.parts) },
    level: levelForPoints(total.earned),
    points: { today, week, total },
    // Баллы за посещение меняются только через отметку посещаемости
    history: history.map(({ attendanceSessionId, awardedBy, ...e }) => ({
      ...e, attendance: attendanceSessionId !== null, author: awardedBy?.teacher?.name ?? null,
    })),
    badges: await studentBadges(studentId, student.groupId, attendance),
    portfolio: portfolio.map(({ createdBy, ...p }) => ({ ...p, author: createdBy.teacher?.name ?? '' })),
    attendance: {
      attended,
      total: attendance.length,
      records: attendance.map((a) => ({ date: dbDateKey(a.session.date), lesson: a.session.lessonNumber, present: a.present })),
    },
  };
}

export type StudentProfile = Awaited<ReturnType<typeof studentProfile>>;
