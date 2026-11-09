import type { Terms } from '@heroes/shared/terms';
import type { WorkAddress } from '../../lib/api';

/** Создатель группы: в школе — классный руководитель, в колледже и вузе — куратор */
export const curatorTitle = (t: Terms) => (t.kind === 'SCHOOL' ? 'Классный руководитель' : 'Куратор группы');

/** «Математика — Пётр Ильич», «Куратор группы — Анна Сергеевна» или просто имя преподавателя без дисциплины */
export function addressText(to: Omit<WorkAddress, 'teacherId'>, t: Terms) {
  const teacher = to.teacher ?? 'преподаватель удалён';
  if (to.subject) return `${to.subject} — ${teacher}`;
  return to.curator ? `${curatorTitle(t)} — ${teacher}` : teacher;
}
