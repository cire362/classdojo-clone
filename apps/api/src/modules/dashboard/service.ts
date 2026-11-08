import type { Dashboard, DashboardBy } from '@heroes/shared/api';
import type { AuthUser } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { terms } from '../../platform/terms.js';
import { adminGroupsWhere } from '../access/index.js';
import { add, empty, groupTotals, row, type Totals } from './totals.js';

/**
 * Панель руководителя: вовлечённость, посещаемость и поведение по группам, курсам (параллелям)
 * и подразделениям за период. Считается по действующим группам, которые видит сотрудник:
 * декан — только своего факультета.
 */
export async function dashboard(user: AuthUser, by: DashboardBy, from: string, to: string): Promise<Dashboard> {
  const groups = await prisma.group.findMany({
    where: { ...(await adminGroupsWhere(user)), archivedAt: null },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, course: true, department: { select: { id: true, name: true } } },
  });
  const ids = groups.map((g) => g.id);
  const perGroup = await groupTotals(ids, from, to);

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
