import { levelForPoints, normalizeHero } from '@heroes/shared';
import { prisma } from '../db.js';
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
    include: { account: { select: { login: true } }, group: { select: { id: true, name: true } }, hero: true },
  });
  const [today, week, total, history, attendance] = await Promise.all([
    sums(studentId, startOfDay()),
    sums(studentId, startOfWeek()),
    sums(studentId),
    prisma.pointEvent.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, value: true, reasonName: true, emoji: true, createdAt: true },
    }),
    prisma.attendance.findMany({
      where: { studentId },
      include: { session: { select: { date: true } } },
      orderBy: { session: { date: 'desc' } },
    }),
  ]);
  const attended = attendance.filter((a) => a.present).length;
  return {
    student: { id: student.id, name: student.name, login: student.account.login, group: student.group },
    hero: { name: student.hero?.name ?? '', parts: normalizeHero(student.hero?.parts) },
    level: levelForPoints(total.earned),
    points: { today, week, total },
    history,
    attendance: {
      attended,
      total: attendance.length,
      records: attendance.map((a) => ({ date: dbDateKey(a.session.date), present: a.present })),
    },
  };
}

export type StudentProfile = Awaited<ReturnType<typeof studentProfile>>;
