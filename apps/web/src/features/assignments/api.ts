import { api, type AssignmentDetail, type StudentAssignment, type TeacherAssignment } from '../../lib/api';

const base = (groupId: string) => `/teacher/groups/${groupId}/assignments`;

export type AssignmentDraft = {
  title: string;
  description: string;
  /** YYYY-MM-DD или пусто */
  dueOn: string;
  points: number;
  target: 'all' | 'team' | 'students';
  teamId: string;
  studentIds: string[];
  /** Фото уже уменьшены, см. prepareAttachments */
  files: File[];
};

export const fetchGroupAssignments = (groupId: string) => api<TeacherAssignment[]>('GET', base(groupId));

/** Задание уходит одним запросом multipart вместе с файлами */
export function createAssignment(groupId: string, draft: AssignmentDraft) {
  const data = new FormData();
  data.append('title', draft.title);
  data.append('description', draft.description);
  if (draft.dueOn) data.append('dueOn', draft.dueOn);
  data.append('points', String(draft.points));
  data.append('target', draft.target);
  if (draft.target === 'team') data.append('teamId', draft.teamId);
  if (draft.target === 'students') draft.studentIds.forEach((id) => data.append('studentId', id));
  draft.files.forEach((file) => data.append('file', file, file.name));
  return api<TeacherAssignment[]>('POST', base(groupId), data);
}

export const fetchAssignment = (groupId: string, id: string) => api<AssignmentDetail>('GET', `${base(groupId)}/${id}`);

export const decideAnswer = (groupId: string, id: string, workId: string, status: 'APPROVED' | 'RETURNED', comment: string) =>
  api<AssignmentDetail>('PUT', `${base(groupId)}/${id}/answers/${workId}`, { status, comment });

export const deleteAssignment = (groupId: string, id: string) => api<TeacherAssignment[]>('DELETE', `${base(groupId)}/${id}`);

export const fetchStudentAssignments = () => api<StudentAssignment[]>('GET', '/student/assignments');

export function submitAnswer(id: string, answer: { text: string; files: File[] }) {
  const data = new FormData();
  data.append('text', answer.text);
  answer.files.forEach((file) => data.append('file', file, file.name));
  return api<StudentAssignment[]>('POST', `/student/assignments/${id}/answers`, data);
}
