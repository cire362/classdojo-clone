import { BADGES, LEVELS, type StudentBadge } from '@heroes/shared';
import { prisma } from '../db.js';
import { dateKey, dbDateKey } from '../lib/dates.js';

const LEVEL_FIVE = LEVELS[4].threshold;
type Event = { id: string; studentId: string; value: number; createdAt: Date; awardedGroupId: string | null };
type Attendance = { present: boolean; session: { date: Date; lessonNumber: number; createdAt: Date } };

/** Самое раннее достижение уровня каждым учеником в полной хронологии плюсов. Минусы не понижают уровень. */
function crossings(events: Event[]): Map<string, Event> {
  const sums = new Map<string, number>();
  const result = new Map<string, Event>();
  for (const e of events) {
    const total = (sums.get(e.studentId) ?? 0) + e.value;
    sums.set(e.studentId, total);
    if (total >= LEVEL_FIVE && !result.has(e.studentId)) result.set(e.studentId, e);
  }
  return result;
}

/** Первые в группе: при одной временной отметке (например, начисление всему классу) побеждают все. */
async function firstInGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true, badgeTrackingStartedAt: true } });
  if (!group) return null;
  const candidates = await prisma.pointEvent.findMany({
    where: { awardedGroupId: groupId, value: { gt: 0 } },
    distinct: ['studentId'], select: { studentId: true },
  });
  if (!candidates.length) return { name: group.name, winners: [] as Event[] };
  // Нужны и плюсы до перевода/запуска значков: уровень — по всей жизни ученика.
  const events = await prisma.pointEvent.findMany({
    where: { studentId: { in: candidates.map((c) => c.studentId) }, value: { gt: 0 } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, studentId: true, value: true, createdAt: true, awardedGroupId: true },
  });
  const eligible = [...crossings(events).values()].filter((e) => e.awardedGroupId === groupId && e.createdAt >= group.badgeTrackingStartedAt);
  const first = Math.min(...eligible.map((e) => e.createdAt.getTime()));
  return { name: group.name, winners: eligible.filter((e) => e.createdAt.getTime() === first) };
}

/**
 * Значки — проекция истории, без дублирующих записей в портфолио. Поздний пропуск/минус не отнимает
 * уже заработанное, но исправление ошибочного начисления или отметки пересчитывает достижения.
 */
export async function studentBadges(studentId: string, currentGroupId: string, attendance: Attendance[]): Promise<StudentBadge[]> {
  const events = await prisma.pointEvent.findMany({
    where: { studentId, value: { gt: 0 } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, studentId: true, value: true, createdAt: true, awardedGroupId: true, helpBadge: true },
  });
  const rows = [...attendance].sort((a, b) =>
    +a.session.date - +b.session.date || a.session.lessonNumber - b.session.lessonNumber || +a.session.createdAt - +b.session.createdAt,
  );
  let streak = 0;
  let best = 0;
  let streakDate: string | null = null;
  for (const row of rows) {
    streak = row.present ? streak + 1 : 0;
    best = Math.max(best, streak);
    if (streak === 10 && !streakDate) streakDate = dbDateKey(row.session.date);
  }
  const help = events.filter((e) => e.helpBadge);
  const crossing = crossings(events).get(studentId);
  const ranking = await firstInGroup(crossing?.awardedGroupId ?? currentGroupId);
  const winningEvent = ranking?.winners.find((e) => e.studentId === studentId);
  const firstNote = winningEvent ? 'Одновременное достижение считается общим первенством.'
    : crossing && !crossing.awardedGroupId ? 'Первенство по старой истории не определяется: тогда группа начисления не сохранялась.'
    : ranking?.winners.length ? 'В этой группе значок первенства уже заработан.'
    : crossing ? 'Этот уровень был достигнут до запуска значков в группе.'
    : 'Учитываются новые достижения уровня. При одновременном достижении значок получают все.';

  return BADGES.map((badge) => {
    const progress = badge.id === 'attendance.streak10' ? Math.min(best, 10) : badge.id === 'help.20' ? Math.min(help.length, 20) : winningEvent ? 1 : 0;
    const earnedOn = badge.id === 'attendance.streak10' ? streakDate : badge.id === 'help.20' ? (help[19] ? dateKey(help[19].createdAt) : null) : winningEvent ? dateKey(winningEvent.createdAt) : null;
    return { ...badge, progress, earnedOn, note: badge.id === 'level.first5' ? firstNote : null, groupName: badge.id === 'level.first5' && winningEvent ? ranking!.name : null };
  });
}
