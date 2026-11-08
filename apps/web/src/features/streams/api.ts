import { api, type CardSummary, type StreamAttendance, type StreamBoard, type StreamItem } from '../../lib/api';

export interface StreamInput {
  name: string;
  groupIds: string[];
  subjectId: string | null;
}

export const fetchStreams = () => api<StreamItem[]>('GET', '/teacher/streams');

export const saveStream = (id: string | null, body: StreamInput) =>
  id ? api<StreamItem[]>('PATCH', `/teacher/streams/${id}`, body) : api<StreamItem[]>('POST', '/teacher/streams', body);

export const deleteStream = (id: string) => api<StreamItem[]>('DELETE', `/teacher/streams/${id}`);

export const fetchStreamBoard = (id: string) => api<StreamBoard>('GET', `/teacher/streams/${id}`);

export const awardStream = (id: string, studentIds: string[], reasonId: string) =>
  api<{ value: number; summaries: Record<string, CardSummary> }>('POST', `/teacher/streams/${id}/points`, { studentIds, reasonId });

export const fetchStreamAttendance = (id: string, date: string, lesson: number) =>
  api<StreamAttendance>('GET', `/teacher/streams/${id}/attendance?date=${date}&lesson=${lesson}`);

export const saveStreamAttendance = (id: string, body: { date: string; lesson: number; presentStudentIds: string[] }) =>
  api<{ presentCount: number; studentsTotal: number }>('POST', `/teacher/streams/${id}/attendance`, body);
