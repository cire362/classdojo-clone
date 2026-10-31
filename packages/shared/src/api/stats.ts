/** Типы ответов API: статистика */
import type { PointsSum } from './profile.js';

export interface WeeklyStats {
  groupId: string;
  from: string;
  to: string;
  scope: { kind: 'group' | 'student' | 'team'; id: string; name: string };
  members: number;
  points: PointsSum & { events: number };
  weeks: ({ week: string; from: string; to: string; partial: boolean; events: number } & PointsSum)[];
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
    lesson: number;
    peopleOnPhoto: number | null;
    subtractedTeacher: boolean;
    presentCount: number;
    studentsTotal: number;
    /** Кто присутствовал на уроке: нужен листу Excel */
    present: string[];
  }[];
}
