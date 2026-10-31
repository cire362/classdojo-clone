import { api, type AdminGroup, type AdminTeachers, type TeacherCredentials } from '../../lib/api';

export const fetchTeachers = () => api<AdminTeachers>('GET', '/admin/teachers');

export const createTeacher = (form: { name: string; login: string }) => api<TeacherCredentials>('POST', '/admin/teachers', form);

export const resetTeacherPassword = (teacherId: string) => api<TeacherCredentials>('POST', `/admin/teachers/${teacherId}/reset-password`);

export const setTeacherPremium = (teacherId: string, until: string | null) => api('PUT', `/admin/teachers/${teacherId}/premium`, { until });

export const fetchAdminGroups = () => api<AdminGroup[]>('GET', '/admin/groups');

/** Адрес свой у каждой роли, поэтому его передаёт вызывающий */
export const changePassword = (endpoint: string, currentPassword: string, newPassword: string) =>
  api('POST', endpoint, { currentPassword, newPassword });

export const renameTeacher = (name: string) => api('PATCH', '/teacher/me', { name });

export const fetchPlan = () => api<{ active: boolean; until: string | null; freeForAll: boolean }>('GET', '/teacher/plan');
