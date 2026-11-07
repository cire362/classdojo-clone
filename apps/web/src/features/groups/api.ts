import { api, type GroupDetails, type GroupListItem, type GroupTeachers } from '../../lib/api';

export const fetchGroups = () => api<GroupListItem[]>('GET', '/teacher/groups');

export const fetchGroup = (groupId: string) => api<GroupDetails>('GET', `/teacher/groups/${groupId}`);

export const createGroup = (name: string) => api<GroupListItem>('POST', '/teacher/groups', { name });

export const renameGroup = (groupId: string, name: string) => api('PATCH', `/teacher/groups/${groupId}`, { name });

export const setParentsEnabled = (groupId: string, parentsEnabled: boolean) =>
  api('PATCH', `/teacher/groups/${groupId}`, { parentsEnabled });

export const setGroupHeroes = (groupId: string, heroes: boolean) => api('PATCH', `/teacher/groups/${groupId}`, { heroes });

export const archiveGroup = (groupId: string) => api('POST', `/teacher/groups/${groupId}/archive`);

export const restoreGroup = (groupId: string) => api('POST', `/teacher/groups/${groupId}/restore`);

export const deleteGroup = (groupId: string) => api('DELETE', `/teacher/groups/${groupId}`);

export const fetchGroupTeachers = (groupId: string) => api<GroupTeachers>('GET', `/teacher/groups/${groupId}/teachers`);

export const addGroupTeacher = (groupId: string, login: string) => api<GroupTeachers>('POST', `/teacher/groups/${groupId}/teachers`, { login });

export const removeGroupTeacher = (groupId: string, teacherId: string) =>
  api('DELETE', `/teacher/groups/${groupId}/teachers/${teacherId}`);
