import { api, type AttendanceDay, type Detection } from '../../lib/api';
import { uploadForm } from '../../lib/network';

interface SaveBody {
  date: string;
  lesson: number;
  presentStudentIds: string[];
  peopleOnPhoto: number | null;
  subtractedTeacher: boolean;
  subjectId?: string | null;
}

export const fetchAttendanceDay = (groupId: string, date: string, lesson: number | null) =>
  api<AttendanceDay>('GET', `/teacher/groups/${groupId}/attendance?date=${date}${lesson ? `&lesson=${lesson}` : ''}`);

export const deleteAttendance = (groupId: string, date: string, lesson: number) =>
  api('DELETE', `/teacher/groups/${groupId}/attendance?date=${date}&lesson=${lesson}`);

export const saveAttendance = (groupId: string, body: SaveBody) => api('POST', `/teacher/groups/${groupId}/attendance`, body);

export const setSubtractTeacher = (groupId: string, subtractTeacher: boolean) =>
  api('PATCH', `/teacher/groups/${groupId}`, { subtractTeacher });

export const detectPeople = (groupId: string, form: FormData, options: Parameters<typeof uploadForm>[2]) =>
  uploadForm<Detection>(`/teacher/groups/${groupId}/attendance/detect`, form, options);
