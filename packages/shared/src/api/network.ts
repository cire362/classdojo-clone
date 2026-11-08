/** Типы ответов API: панель руководителя сети учреждений */
import type { DashboardRow } from './dashboard.js';
import type { InstitutionKind } from '../terms.js';

export interface NetworkSchool extends DashboardRow {
  kind: InstitutionKind;
  teachers: number;
}

export interface NetworkOverview {
  name: string;
  from: string;
  to: string;
  total: DashboardRow & { teachers: number };
  schools: NetworkSchool[];
}
