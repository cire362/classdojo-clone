/** Типы ответов API: группы, урок и команды */
import type { HeroParts } from '../hero/catalog.js';
import type { Hero } from './profile.js';

export interface GroupListItem {
  id: string;
  name: string;
  subtractTeacher: boolean;
  studentsCount: number;
  archivedAt: string | null;
  previewHeroes: HeroParts[];
  /** Создатель группы; соавтор не может её удалить, архивировать и переименовать */
  isOwner: boolean;
  /** Другие преподаватели группы */
  colleagues: string[];
}

export interface GroupTeacher {
  id: string;
  name: string;
  login: string;
  isMe: boolean;
}

export interface GroupTeachers {
  owner: GroupTeacher;
  coTeachers: GroupTeacher[];
}

export interface Reason {
  id: string;
  name: string;
  emoji: string;
  value: number;
  countsForHelpBadge?: boolean;
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
  /** Сколько родительских входов выдано */
  parentsCount: number;
  teamId: string | null;
}

export interface Team {
  id: string;
  name: string;
  color: string;
}

export interface ClassGoal {
  id: string;
  title: string;
  target: number;
  earned: number;
  reached: boolean;
  createdAt: string;
}

export interface GroupDetails {
  classGoal: ClassGoal | null;
  group: { id: string; name: string; subtractTeacher: boolean; archivedAt: string | null; isOwner: boolean };
  students: LessonStudent[];
  reasons: Reason[];
  teams: Team[];
  /** Запросы наград, ждущие ответа */
  pendingRewards: number;
  todayAttendance: { peopleOnPhoto: number | null; presentStudentIds: string[] } | null;
}
