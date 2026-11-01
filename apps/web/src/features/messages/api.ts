import { api, type ChatMessage, type ParentNotice, type QuietHours, type TeacherThread, type ThreadSummary } from '../../lib/api';

export const fetchThreads = () => api<ThreadSummary[]>('GET', '/teacher/messages');

const threadPath = (studentId: string, parentId: string) => `/teacher/students/${studentId}/parents/${parentId}/messages`;

export const fetchTeacherThread = (studentId: string, parentId: string) => api<TeacherThread>('GET', threadPath(studentId, parentId));

export const sendTeacherMessage = (studentId: string, parentId: string, text: string, sendAt?: string) =>
  api<ChatMessage[]>('POST', threadPath(studentId, parentId), { text, sendAt });

export const cancelMessage = (studentId: string, parentId: string, messageId: string) =>
  api<ChatMessage[]>('DELETE', `${threadPath(studentId, parentId)}/${messageId}`);

export const broadcast = (groupId: string, text: string, sendAt?: string) =>
  api<{ sent: number }>('POST', `/teacher/groups/${groupId}/messages`, { text, sendAt });

export const fetchQuietHours = () => api<{ hours: QuietHours | null }>('GET', '/teacher/me/quiet-hours');

export const saveQuietHours = (hours: QuietHours | null) => api<{ hours: QuietHours | null }>('PUT', '/teacher/me/quiet-hours', { hours });

const childPath = (childId: string) => `/parent/children/${childId}/messages`;

export const fetchChildMessages = (childId: string) => api<ChatMessage[]>('GET', childPath(childId));

export const sendChildMessage = (childId: string, text: string) => api<ChatMessage[]>('POST', childPath(childId), { text });

export const fetchParentNotice = (childId: string) => api<ParentNotice>('GET', `/parent/children/${childId}/quiet-hours`);
