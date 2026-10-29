import { prisma } from '../db.js';
import { addDays, dateKey, dbDate, dbDateKey, localDayStart, startOfWeek } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';

/** Полная календарная неделя по часовому поясу приложения, включая смену года. */
export function weeklyPeriod(week?: string, now = new Date()) {
  const currentFrom = dateKey(startOfWeek(now));
  if (week !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(week) || dateKey(localDayStart(week)) !== week)) {
    throw new HttpError(400, 'Укажите существующую дату в формате ГГГГ-ММ-ДД');
  }
  const start = startOfWeek(localDayStart(week ?? currentFrom));
  const from = dateKey(start);
  if (from > currentFrom) throw new HttpError(400, 'Итог будущей недели ещё недоступен');
  return {
    from, to: dateKey(addDays(start, 6)), currentFrom,
    previousWeek: dateKey(addDays(start, -7)),
    nextWeek: from < currentFrom ? dateKey(addDays(start, 7)) : null,
    isCurrent: from === currentFrom,
  };
}

/** Вызывается только после parentChild: в ответе нет данных других учеников. */
export async function weeklySummary(studentId: string, week?: string) {
  const period = weeklyPeriod(week);
  const { events, marks } = await prisma.$transaction(async (tx) => {
    const events = await tx.pointEvent.groupBy({
      by: ['reasonName', 'emoji', 'value'],
      orderBy: [{ reasonName: 'asc' }, { emoji: 'asc' }, { value: 'asc' }],
      where: { studentId, createdAt: { gte: localDayStart(period.from), lt: addDays(localDayStart(period.to), 1) } },
      _count: { _all: true },
    });
    const marks = await tx.attendance.findMany({
      where: { studentId, session: { date: { gte: dbDate(period.from), lte: dbDate(period.to) } } },
      select: { id: true, present: true, session: { select: { date: true, lessonNumber: true, group: { select: { name: true } } } } },
      orderBy: [{ session: { date: 'asc' } }, { session: { lessonNumber: 'asc' } }, { id: 'asc' }],
    });
    return { events, marks };
  }, { isolationLevel: 'RepeatableRead' });
  const grouped = new Map<string, { name: string; emoji: string; earned: number; lost: number; count: number }>();
  const points = { earned: 0, lost: 0, net: 0, events: 0 };
  for (const e of events) {
    const key = JSON.stringify([e.reasonName, e.emoji]);
    const row = grouped.get(key) ?? { name: e.reasonName, emoji: e.emoji, earned: 0, lost: 0, count: 0 };
    const total = e.value * e._count._all;
    if (total > 0) { row.earned += total; points.earned += total; }
    else { row.lost -= total; points.lost -= total; }
    row.count += e._count._all;
    points.events += e._count._all;
    grouped.set(key, row);
  }
  points.net = points.earned - points.lost;
  const attended = marks.filter((r) => r.present).length;
  return {
    studentId, ...period, points,
    reasons: [...grouped.values()].sort((a, b) => b.earned - a.earned || b.lost - a.lost || a.name.localeCompare(b.name, 'ru')),
    attendance: {
      total: marks.length, attended, missed: marks.length - attended,
      records: marks.map((r) => ({ id: r.id, date: dbDateKey(r.session.date), lesson: r.session.lessonNumber, present: r.present, groupName: r.session.group.name })),
    },
  };
}
