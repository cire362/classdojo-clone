import {
  api,
  type Credentials,
  type Hero,
  type ParentAccess,
  type ParentCredentials,
  type PortfolioItem,
  type Profile,
} from '../../lib/api';
import type { ImportPreview } from './components/ImportStudentsModal';

export const addStudents = (groupId: string, names: string[]) =>
  api<{ credentials: Credentials[] }>('POST', `/teacher/groups/${groupId}/students`, { names });

export function previewImport(groupId: string, file: File) {
  const form = new FormData();
  form.append('file', file, file.name);
  return api<ImportPreview>('POST', `/teacher/groups/${groupId}/students/import-preview`, form);
}

export const renameStudent = (studentId: string, name: string) => api('PATCH', `/teacher/students/${studentId}`, { name });

export const deleteStudent = (studentId: string) => api('DELETE', `/teacher/students/${studentId}`);

export const resetStudentPassword = (studentId: string) => api<Credentials>('POST', `/teacher/students/${studentId}/reset-password`);

export const issueGroupParents = (groupId: string) =>
  api<{ credentials: ParentCredentials[] }>('POST', `/teacher/groups/${groupId}/parents`);

export const moveStudent = (studentId: string, groupId: string) =>
  api<{ groupId: string; groupName: string }>('POST', `/teacher/students/${studentId}/move`, { groupId });

export const resetGroupPasswords = (groupId: string) =>
  api<{ credentials: Credentials[] }>('POST', `/teacher/groups/${groupId}/reset-passwords`, {});

export const fetchStudentParents = (studentId: string) => api<ParentAccess[]>('GET', `/teacher/students/${studentId}/parents`);

export const issueParent = (studentId: string) => api<ParentCredentials>('POST', `/teacher/students/${studentId}/parents`);

export const resetParentPassword = (studentId: string, parentId: string) =>
  api<ParentCredentials>('POST', `/teacher/students/${studentId}/parents/${parentId}/reset-password`);

export const linkParent = (studentId: string, login: string) =>
  api<ParentAccess[]>('POST', `/teacher/students/${studentId}/parents/link`, { login });

export const unlinkParent = (studentId: string, parentId: string) =>
  api<ParentAccess[]>('DELETE', `/teacher/students/${studentId}/parents/${parentId}`);

export const fetchStudentProfile = (studentId: string) => api<Profile>('GET', `/teacher/students/${studentId}/profile`);

export const addPortfolioItem = (studentId: string, item: Omit<PortfolioItem, 'id' | 'createdAt' | 'author'>) =>
  api<PortfolioItem[]>('POST', `/teacher/students/${studentId}/portfolio`, item);

export const deletePortfolioItem = (itemId: string) => api<PortfolioItem[]>('DELETE', `/teacher/portfolio/${itemId}`);

export const deletePointEvent = (eventId: string) => api('DELETE', `/teacher/points/${eventId}`);

export const saveStudentHero = (studentId: string, name: string, parts: Record<string, string>) =>
  api<Hero>('PUT', `/teacher/students/${studentId}/hero`, { name, parts });
