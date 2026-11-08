/** Типы ответов API: панель руководителя учреждения */

export type DashboardBy = 'group' | 'course' | 'department';

export interface DashboardRow {
  key: string;
  name: string;
  groups: number;
  students: number;
  /** Доля учеников, получивших хотя бы один плюс за период; пусто, если учеников нет */
  engagement: number | null;
  /** Отмеченных уроков */
  lessons: number;
  attendance: number | null;
  earned: number;
  lost: number;
}

export interface Dashboard {
  from: string;
  to: string;
  by: DashboardBy;
  total: DashboardRow;
  rows: DashboardRow[];
}
