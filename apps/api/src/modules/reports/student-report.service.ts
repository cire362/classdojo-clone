import { levelForPoints } from '@heroes/shared';
import { prisma } from '../../platform/db.js';
import { addDays, dateKey, dbDate, dbDateKey, localDayStart } from '../../platform/dates.js';
import { HttpError } from '../../platform/errors.js';
import { trendPeriod } from './weekly-stats.service.js';

/** Только после teacherStudent. Согласованный отчёт, без лимита истории профиля. */
export async function studentReport(studentId: string, teacherId: string, query: { from?: string; to?: string }) {
  const period = trendPeriod(query.from, query.to);
  if (period.to > dateKey()) throw new HttpError(400, 'Отчёт можно сформировать только по сегодняшнюю дату');
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { name: true, group: { select: { name: true } } },
    });
    const teacher = await tx.teacher.findUniqueOrThrow({ where: { id: teacherId }, select: { name: true } });
    const earned = await tx.pointEvent.aggregate({ where: { studentId, value: { gt: 0 } }, _sum: { value: true } });
    const events = await tx.pointEvent.groupBy({
      by: ['reasonName', 'value'],
      orderBy: [{ reasonName: 'asc' }, { value: 'asc' }],
      where: { studentId, createdAt: { gte: localDayStart(period.from), lt: addDays(localDayStart(period.to), 1) } },
      _count: { _all: true },
    });
    const marks = await tx.attendance.findMany({
      where: { studentId, session: { date: { gte: dbDate(period.from), lte: dbDate(period.to) } } },
      select: { present: true, session: { select: { date: true, lessonNumber: true, group: { select: { name: true } } } } },
      orderBy: [{ session: { date: 'asc' } }, { session: { lessonNumber: 'asc' } }, { id: 'asc' }],
    });
    const reasons = new Map<string, { name: string; count: number; earned: number; lost: number }>();
    const points = { earned: 0, lost: 0, net: 0 };
    for (const e of events) {
      const row = reasons.get(e.reasonName) ?? { name: e.reasonName, count: 0, earned: 0, lost: 0 };
      const value = e.value * e._count._all;
      if (value > 0) { row.earned += value; points.earned += value; }
      else { row.lost -= value; points.lost -= value; }
      row.count += e._count._all;
      reasons.set(e.reasonName, row);
    }
    points.net = points.earned - points.lost;
    const attended = marks.filter((m) => m.present).length;
    return {
      studentName: student.name, groupName: student.group.name, teacherName: teacher.name,
      ...period, generatedAt: new Date().toISOString(), level: levelForPoints(earned._sum.value ?? 0), points,
      reasons: [...reasons.values()].sort((a, b) => b.earned - a.earned || b.lost - a.lost || a.name.localeCompare(b.name, 'ru')),
      attendance: {
        total: marks.length,
        attended,
        missed: marks.length - attended,
        records: marks.map((m) => ({
          date: dbDateKey(m.session.date),
          lesson: m.session.lessonNumber,
          present: m.present,
          groupName: m.session.group.name,
        })),
      },
    };
  }, { isolationLevel: 'RepeatableRead' });
}

export type StudentReport = Awaited<ReturnType<typeof studentReport>>;
