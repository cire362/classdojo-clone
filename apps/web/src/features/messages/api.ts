import { api, type ChatMessage, type ParentNotice, type QuietHours, type TeacherThread, type ThreadSummary } from '../../lib/api';

/** Исходящее сообщение: файлы уже подготовлены (см. prepareAttachments) */
export type Outgoing = { text: string; sendAt?: string; files: File[] };

/** Без файлов сообщение уходит JSON, с файлами — одним запросом multipart: сервер сохранит его целиком или никак */
export function messageBody({ text, sendAt, files }: Outgoing) {
  if (!files.length) return { text, sendAt };
  const data = new FormData();
  data.append('text', text);
  if (sendAt) data.append('sendAt', sendAt);
  files.forEach((file) => data.append('file', file, file.name));
  return data;
}

export const fetchThreads = () => api<ThreadSummary[]>('GET', '/teacher/messages');

const threadPath = (studentId: string, parentId: string) => `/teacher/students/${studentId}/parents/${parentId}/messages`;

export const fetchTeacherThread = (studentId: string, parentId: string) => api<TeacherThread>('GET', threadPath(studentId, parentId));

export const sendTeacherMessage = (studentId: string, parentId: string, message: Outgoing) =>
  api<ChatMessage[]>('POST', threadPath(studentId, parentId), messageBody(message));

export const cancelMessage = (studentId: string, parentId: string, messageId: string) =>
  api<ChatMessage[]>('DELETE', `${threadPath(studentId, parentId)}/${messageId}`);

export const broadcast = (groupId: string, message: Outgoing) =>
  api<{ sent: number }>('POST', `/teacher/groups/${groupId}/messages`, messageBody(message));

export const fetchQuietHours = () => api<{ hours: QuietHours | null }>('GET', '/teacher/me/quiet-hours');

export const saveQuietHours = (hours: QuietHours | null) => api<{ hours: QuietHours | null }>('PUT', '/teacher/me/quiet-hours', { hours });

const childPath = (childId: string) => `/parent/children/${childId}/messages`;

export const fetchChildMessages = (childId: string) => api<ChatMessage[]>('GET', childPath(childId));

export const sendChildMessage = (childId: string, message: Outgoing) =>
  api<ChatMessage[]>('POST', childPath(childId), messageBody(message));

export const fetchParentNotice = (childId: string) => api<ParentNotice>('GET', `/parent/children/${childId}/quiet-hours`);
