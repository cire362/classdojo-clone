/** Типы ответов API: потоки — занятие сразу для нескольких групп */
import type { CardSummary, Reason } from './groups.js';
import type { Hero } from './profile.js';

export interface StreamItem {
  id: string;
  name: string;
  subject: { id: string; name: string } | null;
  /** Действующие группы потока, доступные преподавателю */
  groups: { id: string; name: string }[];
}

export interface StreamStudent extends CardSummary {
  id: string;
  name: string;
  hero: Hero;
}

export interface StreamBoard {
  stream: StreamItem;
  groups: { id: string; name: string; students: StreamStudent[] }[];
  /** Причины первой группы: в остальных при начислении берётся такая же */
  reasons: Reason[];
}

export interface StreamAttendance {
  date: string;
  lesson: number;
  /** В скольких группах потока этот урок уже отмечен */
  marked: number;
  presentStudentIds: string[];
}
