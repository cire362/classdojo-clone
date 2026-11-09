import type { Terms } from '@heroes/shared/terms';
import type { WorkAddress } from '../../lib/api';

/** Создатель группы: в школе — классный руководитель, в колледже и вузе — куратор */
export const curatorTitle = (t: Terms) => (t.kind === 'SCHOOL' ? 'Классный руководитель' : 'Куратор группы');

/** «Математика — Петров П. П.» или «Куратор группы — Иванова А. П.» */
export function addressText(to: WorkAddress, t: Terms) {
  return `${to.subject ?? curatorTitle(t)} — ${to.teacher ?? 'преподаватель не назначен'}`;
}
