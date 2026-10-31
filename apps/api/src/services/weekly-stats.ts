import { prisma } from '../platform/db.js';
import { addDays, dateKey, dbDate, localDayStart, startOfWeek } from '../platform/dates.js';
import { HttpError, notFound } from '../platform/errors.js';

export function trendPeriod(from?: string, to?: string, now = new Date()) {
  from ??= dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  to ??= dateKey(now);
  for (const key of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(localDayStart(key)) !== key) throw new HttpError(400, 'Укажите существующие даты периода');
  }
  if (from > to) throw new HttpError(400, 'Начало периода позже конца');
  if ((+dbDate(to) - +dbDate(from)) / 86_400_000 >= 366) throw new HttpError(400, 'Для графика выберите период не длиннее 366 дней');
  return { from, to };
}

/** Как таблица статистики: баллы текущего состава группы/команды, включая историю до перевода. */
export async function weeklyStats(groupId: string, query: { from?: string; to?: string; studentId?: string; teamId?: string }) {
  const { from, to } = trendPeriod(query.from, query.to);
  if (query.studentId !== undefined && query.teamId !== undefined) throw new HttpError(400, 'Выберите ученика или команду');
  return prisma.$transaction(async (tx) => {
    let scope: { kind: 'group' | 'student' | 'team'; id: string; name: string };
    if (query.studentId !== undefined) {
      const student = await tx.student.findFirst({ where: { id: query.studentId, groupId }, select: { id: true, name: true } });
      if (!student) throw notFound('Ученик не найден в группе');
      scope = { kind: 'student', ...student };
    } else if (query.teamId !== undefined) {
      const team = await tx.team.findFirst({ where: { id: query.teamId, groupId }, select: { id: true, name: true } });
      if (!team) throw notFound('Команда не найдена в группе');
      scope = { kind: 'team', ...team };
    } else {
      const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, select: { id: true, name: true } });
      scope = { kind: 'group', ...group };
    }
    const roster = { groupId, ...(query.studentId !== undefined ? { id: query.studentId } : {}), ...(query.teamId !== undefined ? { teamId: query.teamId } : {}) };
    const members = await tx.student.count({ where: roster });
    const events = await tx.pointEvent.findMany({
      where: { student: roster, createdAt: { gte: localDayStart(from), lt: addDays(localDayStart(to), 1) } },
      select: { createdAt: true, value: true },
    });
    const weeks = [];
    const rangeStart = localDayStart(from), rangeEnd = localDayStart(to);
    for (let d = startOfWeek(rangeStart); +d <= +rangeEnd; d = addDays(d, 7)) {
      const week = dateKey(d);
      const sunday = addDays(d, 6);
      weeks.push({ week, from: d < rangeStart ? from : week, to: sunday > rangeEnd ? to : dateKey(sunday), partial: d < rangeStart || sunday > rangeEnd, earned: 0, lost: 0, net: 0, events: 0 });
    }
    const byWeek = new Map(weeks.map((w) => [w.week, w]));
    const points = { earned: 0, lost: 0, net: 0, events: events.length };
    for (const e of events) {
      const row = byWeek.get(dateKey(startOfWeek(e.createdAt)))!;
      if (e.value > 0) { row.earned += e.value; points.earned += e.value; }
      else { row.lost -= e.value; points.lost -= e.value; }
      row.net += e.value; row.events++;
    }
    points.net = points.earned - points.lost;
    return { groupId, from, to, scope, members, points, weeks };
  }, { isolationLevel: 'RepeatableRead' });
}
