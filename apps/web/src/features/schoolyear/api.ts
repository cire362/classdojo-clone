import { api, type SchoolYearPreview, type SchoolYearResult } from '../../lib/api';

export const fetchSchoolYear = () => api<SchoolYearPreview>('GET', '/admin/school-year');

export const startSchoolYear = (body: { graduateIds: string[]; rename: boolean; force: boolean }) =>
  api<SchoolYearResult>('POST', '/admin/school-year', body);
