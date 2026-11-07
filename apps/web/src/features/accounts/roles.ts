import type { SchoolRole } from '../../lib/api';

export const ROLE_NAMES: Record<SchoolRole, string> = { DIRECTOR: 'Директор', DEPUTY: 'Завуч', STAFF: 'Сотрудник' };

export const ROLE_HINTS: Record<SchoolRole, string> = {
  DIRECTOR: 'Всё в школе, включая администрацию и название',
  DEPUTY: 'Преподаватели, заявки на подключение, файлы групп',
  STAFF: 'Ящик школы: ответы семьям; остальное только просмотр',
};

/** Директор и завуч ведут преподавателей, заявки и выгрузку файлов */
export const canManageTeachers = (role: SchoolRole) => role !== 'STAFF';
