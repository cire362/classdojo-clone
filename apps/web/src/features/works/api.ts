import { api, type GroupWorks, type StudentWork, type WorkRecipients } from '../../lib/api';

export const fetchOwnWorks = () => api<StudentWork[]>('GET', '/student/works');

/** Работа уходит одним запросом multipart: сервер сохранит её вместе с файлами или никак. Файлы уже подготовлены */
export function submitWork(work: { title: string; text: string; files: File[]; subjectId: string }) {
  const data = new FormData();
  data.append('title', work.title);
  data.append('text', work.text);
  if (work.subjectId) data.append('subjectId', work.subjectId);
  work.files.forEach((file) => data.append('file', file, file.name));
  return api<StudentWork[]>('POST', '/student/works', data);
}

export const fetchRecipients = () => api<WorkRecipients>('GET', '/student/works/recipients');

export const deleteOwnWork = (id: string) => api<StudentWork[]>('DELETE', `/student/works/${id}`);

export const fetchGroupWorks = (groupId: string) => api<GroupWorks>('GET', `/teacher/groups/${groupId}/works`);

export const decideWork = (groupId: string, id: string, status: 'APPROVED' | 'RETURNED', comment: string) =>
  api<GroupWorks>('PUT', `/teacher/groups/${groupId}/works/${id}`, { status, comment });

export const deleteWork = (id: string) => api<GroupWorks>('DELETE', `/teacher/works/${id}`);
