import { api, type Credentials, type ParentCredentials } from '../../lib/api';
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
