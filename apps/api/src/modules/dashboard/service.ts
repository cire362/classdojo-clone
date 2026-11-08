import type { Dashboard, DashboardBy, DashboardRow } from '@heroes/shared/api';
import type { AuthUser } from '../../platform/auth.js';
import { addDays, dbDate, localDayStart } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { terms } from '../../platform/terms.js';
import { adminGroupsWhere } from '../access/index.js';

/**
 * Панель руководителя: вовлечённость, посещаемость и поведение по группам, курсам (параллелям)
 * и подразделениям за период. Считается по действующим группам, которые видит сотрудник:
 * декан — только своего факультета.
 */
type Totals = {
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

const empty = (): Totals => ({ groups: 0, students: 0, active: 0, lessons: 0, present: 0, marked: 0, earned: 0, lost: 0 });

function add(into: Totals, from: Totals) {
  for (const key of Object.keys(into) as (keyof Totals)[]) into[key] += from[key];
}

const row = (key: string, name: string, t: Totals): DashboardRow => ({
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

export async function dashboard(user: AuthUser, by: DashboardBy, from: string, to: string): Promise<Dashboard> {
  const groups = await prisma.group.findMany({
    where: { ...(await adminGroupsWhere(user)), archivedAt: null },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, course: true, department: { select: { id: true, name: true } } },
  });
  const ids = groups.map((g) => g.id);
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

  const words = terms();
  const keyOf = (g: (typeof groups)[number]): [string, string] => {
    if (by === 'course') {
      return g.course ? [`c${String(g.course).padStart(2, '0')}`, `${words.course} ${g.course}`] : ['~', 'Не указан'];
    }
    if (by === 'department') return g.department ? [g.department.id, g.department.name] : ['~', `Без ${words.department.one.gen}`];
    return [g.id, g.name];
  };
  const buckets = new Map<string, { name: string; totals: Totals }>();
  const total = empty();
  for (const g of groups) {
    const [key, name] = keyOf(g);
    const bucket = buckets.get(key) ?? { name, totals: empty() };
    add(bucket.totals, perGroup.get(g.id)!);
    add(total, perGroup.get(g.id)!);
    buckets.set(key, bucket);
  }
  const order = [...buckets.entries()].sort(([a, x], [b, y]) => {
    if (a === '~' || b === '~') return a === '~' ? 1 : -1;
    return by === 'course' ? a.localeCompare(b) : x.name.localeCompare(y.name, 'ru');
  });
  return { from, to, by, total: row('total', 'Всего', total), rows: order.map(([key, b]) => row(key, b.name, b.totals)) };
}
