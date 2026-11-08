import { api, type GroupSubject, type Subject, type SubjectSummary } from '../../lib/api';

export const fetchSubjects = () => api<Subject[]>('GET', '/teacher/subjects');

export const createSubject = (name: string) => api<Subject[]>('POST', '/teacher/subjects', { name });

export const fetchSchoolTeachers = () => api<{ id: string; name: string }[]>('GET', '/teacher/school-teachers');

export const setGroupSubject = (groupId: string, subjectId: string, teacherId: string) =>
  api<GroupSubject[]>('POST', `/teacher/groups/${groupId}/subjects`, { subjectId, teacherId });

export const removeGroupSubject = (groupId: string, linkId: string) =>
  api<GroupSubject[]>('DELETE', `/teacher/groups/${groupId}/subjects/${linkId}`);

export const fetchSubjectSummary = (groupId: string, from: string, to: string) =>
  api<SubjectSummary[]>('GET', `/teacher/groups/${groupId}/subjects/summary?from=${from}&to=${to}`);

export const fetchAdminSubjects = () => api<Subject[]>('GET', '/admin/subjects');

export const createAdminSubject = (name: string) => api<Subject[]>('POST', '/admin/subjects', { name });

export const renameAdminSubject = (id: string, name: string) => api<Subject[]>('PATCH', `/admin/subjects/${id}`, { name });

export const deleteAdminSubject = (id: string) => api<Subject[]>('DELETE', `/admin/subjects/${id}`);
