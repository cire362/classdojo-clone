import { api, type ChatMessage, type TeacherThread, type ThreadSummary } from '../../lib/api';

export const fetchThreads = () => api<ThreadSummary[]>('GET', '/teacher/messages');

const threadPath = (studentId: string, parentId: string) => `/teacher/students/${studentId}/parents/${parentId}/messages`;

export const fetchTeacherThread = (studentId: string, parentId: string) => api<TeacherThread>('GET', threadPath(studentId, parentId));

export const sendTeacherMessage = (studentId: string, parentId: string, text: string) =>
  api<ChatMessage[]>('POST', threadPath(studentId, parentId), { text });

const childPath = (childId: string) => `/parent/children/${childId}/messages`;

export const fetchChildMessages = (childId: string) => api<ChatMessage[]>('GET', childPath(childId));

export const sendChildMessage = (childId: string, text: string) => api<ChatMessage[]>('POST', childPath(childId), { text });
