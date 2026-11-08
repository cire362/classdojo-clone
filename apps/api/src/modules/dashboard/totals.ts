import type { DashboardRow } from '@heroes/shared/api';
import { addDays, dbDate, localDayStart } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';

/** Показатели групп за период: из них складываются строки панели учреждения и панели сети */
export type Totals = {
  groups: number;
  students: number;
  /** Получили хотя бы один плюс за период */
  active: number;
  lessons: number;
  present: number;
  marked: number;
  earned: number;
  lost: number;
};

export const empty = (): Totals => ({ groups: 0, students: 0, active: 0, lessons: 0, present: 0, marked: 0, earned: 0, lost: 0 });

export function add(into: Totals, from: Totals) {
  for (const key of Object.keys(into) as (keyof Totals)[]) into[key] += from[key];
}

export const row = (key: string, name: string, t: Totals): DashboardRow => ({
  key,
  name,
  groups: t.groups,
  students: t.students,
  engagement: t.students ? t.active / t.students : null,
  lessons: t.lessons,
  attendance: t.marked ? t.present / t.marked : null,
  earned: t.earned,
  lost: t.lost,
});

export async function groupTotals(ids: string[], from: string, to: string): Promise<Map<string, Totals>> {
  const createdAt = { gte: localDayStart(from), lt: addDays(localDayStart(to), 1) };
  const inGroups = { student: { groupId: { in: ids } }, createdAt };
  const [students, plus, minus, sessions] = await Promise.all([
    prisma.student.findMany({ where: { groupId: { in: ids } }, select: { id: true, groupId: true } }),
    prisma.pointEvent.groupBy({ by: ['studentId'], where: { ...inGroups, value: { gt: 0 } }, _sum: { value: true } }),
    prisma.pointEvent.groupBy({ by: ['studentId'], where: { ...inGroups, value: { lt: 0 } }, _sum: { value: true } }),
    prisma.attendanceSession.findMany({
      where: { groupId: { in: ids }, date: { gte: dbDate(from), lte: dbDate(to) } },
      select: { groupId: true, studentsTotal: true, _count: { select: { records: { where: { present: true } } } } },
    }),
  ]);
  const perGroup = new Map(ids.map((id) => [id, { ...empty(), groups: 1 }]));
  const groupOf = new Map(students.map((s) => [s.id, s.groupId]));
  for (const s of students) perGroup.get(s.groupId)!.students += 1;
  for (const p of plus) {
    const t = perGroup.get(groupOf.get(p.studentId)!)!;
    t.earned += p._sum.value ?? 0;
    t.active += 1;
  }
  for (const m of minus) perGroup.get(groupOf.get(m.studentId)!)!.lost -= m._sum.value ?? 0;
  for (const s of sessions) {
    const t = perGroup.get(s.groupId)!;
    t.lessons += 1;
    t.marked += s.studentsTotal;
    t.present += s._count.records;
  }
  return perGroup;
}
