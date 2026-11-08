import {
  api, type AdminGroup, type AdminTeachers, type SchoolInfo, type SchoolJoinPreview, type SchoolRole, type StaffMember,
  type TeacherCredentials, type TeacherRequest,
} from '../../lib/api';
import type { InstitutionKind } from '@heroes/shared/terms';

export const fetchTeachers = () => api<AdminTeachers>('GET', '/admin/teachers');

export const createTeacher = (form: { name: string; login: string }) => api<TeacherCredentials>('POST', '/admin/teachers', form);

export const resetTeacherPassword = (teacherId: string) => api<TeacherCredentials>('POST', `/admin/teachers/${teacherId}/reset-password`);

export const setTeacherPremium = (teacherId: string, until: string | null) => api('PUT', `/admin/teachers/${teacherId}/premium`, { until });

export const fetchAdminGroups = () => api<AdminGroup[]>('GET', '/admin/groups');

export const fetchSchool = () => api<SchoolInfo>('GET', '/admin/school');

export const updateSchool = (data: { name: string; kind: InstitutionKind; heroes?: boolean }) =>
  api<SchoolInfo>('PATCH', '/admin/school', data);

export const fetchStaff = () => api<StaffMember[]>('GET', '/admin/staff');

export const createStaff = (form: { name: string; login: string; role: SchoolRole }) =>
  api<TeacherCredentials>('POST', '/admin/staff', form);

export const setStaffRole = (id: string, role: SchoolRole) => api<StaffMember[]>('PUT', `/admin/staff/${id}/role`, { role });

export const resetStaffPassword = (id: string) => api<TeacherCredentials>('POST', `/admin/staff/${id}/reset-password`);

export const removeStaff = (id: string) => api<StaffMember[]>('DELETE', `/admin/staff/${id}`);

export const renewJoinCode = () => api<{ joinCode: string }>('POST', '/admin/join-code');

export const disableJoinCode = () => api<{ joinCode: null }>('DELETE', '/admin/join-code');

export const fetchTeacherRequests = () => api<TeacherRequest[]>('GET', '/admin/teacher-requests');

export const approveTeacher = (id: string) => api<TeacherRequest[]>('POST', `/admin/teacher-requests/${id}/approve`);

export const rejectTeacher = (id: string) => api<TeacherRequest[]>('DELETE', `/admin/teacher-requests/${id}`);

export const previewSchoolJoin = (code: string) => api<SchoolJoinPreview>('POST', '/auth/school-join/preview', { code });

export const joinSchool = (form: { code: string; name: string; login: string; password: string }) =>
  api<SchoolJoinPreview>('POST', '/auth/school-join', form);

/** Адрес свой у каждой роли, поэтому его передаёт вызывающий */
export const changePassword = (endpoint: string, currentPassword: string, newPassword: string) =>
  api('POST', endpoint, { currentPassword, newPassword });

export const renameTeacher = (name: string) => api('PATCH', '/teacher/me', { name });

export const fetchPlan = () => api<{ active: boolean; until: string | null; freeForAll: boolean }>('GET', '/teacher/plan');

export const updateAdminGroup = (groupId: string, data: { departmentId: string | null; course: number | null; specialty: string }) =>
  api<AdminGroup[]>('PATCH', `/admin/groups/${groupId}`, data);

export const setStaffDepartment = (staffId: string, departmentId: string | null) =>
  api<StaffMember[]>('PUT', `/admin/staff/${staffId}/department`, { departmentId });

export const setTeacherDisabled = (teacherId: string, disabled: boolean) =>
  api<AdminTeachers>('PUT', `/admin/teachers/${teacherId}/disabled`, { disabled });

export const transferTeacherGroups = (teacherId: string, toTeacherId: string) =>
  api<AdminTeachers & { moved: number }>('POST', `/admin/teachers/${teacherId}/transfer`, { toTeacherId });

export const deleteTeacher = (teacherId: string) => api<AdminTeachers>('DELETE', `/admin/teachers/${teacherId}`);
