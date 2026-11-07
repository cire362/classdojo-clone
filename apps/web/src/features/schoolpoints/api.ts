import { api, type RatingPeriod, type SchoolGoal, type SchoolPoints, type SchoolReason } from '../../lib/api';

export const fetchTeacherSchoolPoints = (period: RatingPeriod) => api<SchoolPoints>('GET', `/teacher/school-points?period=${period}`);

export const fetchAdminSchoolPoints = (period: RatingPeriod) => api<SchoolPoints>('GET', `/admin/school-points?period=${period}`);

export const fetchStudentSchoolGoal = () => api<{ goal: SchoolGoal | null }>('GET', '/student/school-goal');

export const saveSchoolGoal = (goal: { title: string; target: number; restart?: boolean }) =>
  api<SchoolGoal>('PUT', '/admin/school-goal', goal);

export const deleteSchoolGoal = () => api('DELETE', '/admin/school-goal');

type ReasonData = Omit<SchoolReason, 'id'>;

export const fetchSchoolReasons = () => api<SchoolReason[]>('GET', '/admin/school-reasons');

export const addSchoolReason = (reason: ReasonData) => api<SchoolReason[]>('POST', '/admin/school-reasons', reason);

export const updateSchoolReason = (id: string, reason: ReasonData) => api<SchoolReason[]>('PATCH', `/admin/school-reasons/${id}`, reason);

export const deleteSchoolReason = (id: string) => api<SchoolReason[]>('DELETE', `/admin/school-reasons/${id}`);
