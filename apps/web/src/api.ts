import type { HeroParts, LevelInfo } from '@heroes/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Heroes-Client': '1' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('heroes:unauthorized'));
    throw new ApiError(res.status, data?.error ?? `Ошибка ${res.status}`);
  }
  return data as T;
}

export type Role = 'TEACHER' | 'STUDENT';
export interface Me {
  login: string;
  role: Role;
  name: string;
}

export interface Hero {
  name: string;
  parts: HeroParts;
}

export interface GroupListItem {
  id: string;
  name: string;
  subtractTeacher: boolean;
  studentsCount: number;
  previewHeroes: HeroParts[];
}

export interface Reason {
  id: string;
  name: string;
  emoji: string;
  value: number;
}

export interface CardSummary {
  todayEarned: number;
  totalEarned: number;
  level: number;
}

export interface LessonStudent extends CardSummary {
  id: string;
  name: string;
  login: string;
  hero: Hero;
}

export interface GroupDetails {
  group: { id: string; name: string; subtractTeacher: boolean };
  students: LessonStudent[];
  reasons: Reason[];
  todayAttendance: { peopleOnPhoto: number | null; presentStudentIds: string[] } | null;
}

export interface Credentials {
  id: string;
  name: string;
  login: string;
  password: string;
}

export interface PointsSum {
  earned: number;
  lost: number;
  net: number;
}

export interface Profile {
  student: { id: string; name: string; login: string; group: { id: string; name: string } };
  hero: Hero;
  level: LevelInfo;
  points: { today: PointsSum; week: PointsSum; total: PointsSum };
  history: { id: string; value: number; reasonName: string; emoji: string; createdAt: string }[];
  attendance: { attended: number; total: number; records: { date: string; present: boolean }[] };
}

export interface Detection {
  count: number;
  width: number;
  height: number;
  boxes: { x: number; y: number; w: number; h: number; score: number }[];
  elapsedMs: number;
}

export interface Stats {
  from: string;
  to: string;
  students: {
    id: string;
    name: string;
    login: string;
    earned: number;
    lost: number;
    net: number;
    level: number;
    attended: number;
    sessions: number;
    attendanceRate: number | null;
  }[];
  sessions: {
    id: string;
    date: string;
    peopleOnPhoto: number | null;
    subtractedTeacher: boolean;
    presentCount: number;
    studentsTotal: number;
  }[];
}
