import type { Terms } from '@heroes/shared/terms';
import type { SchoolRole } from '../../lib/api';

/** Что может каждая должность. Названия должностей — из словаря: директор и завуч в школе, ректор и проректор в вузе */
export const roleHints = (t: Terms): Record<SchoolRole, string> => ({
  DIRECTOR: `Всё в ${t.org.one.prep}, включая администрацию и название`,
  DEPUTY: `Преподаватели, заявки на подключение, файлы ${t.group.many.gen}`,
  STAFF: `Ящик ${t.org.one.gen}: ответы семьям; остальное только просмотр`,
});

/** Руководитель и заместитель ведут преподавателей, заявки и выгрузку файлов */
export const canManageTeachers = (role: SchoolRole) => role !== 'STAFF';
