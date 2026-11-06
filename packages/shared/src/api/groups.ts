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
  /** Фото ученика не публикуются в ленте */
  noPhotos: boolean;
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

/** Событие календаря: дата «ГГГГ-ММ-ДД», время «ЧЧ:ММ» или null на весь день */
export interface ClassEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string | null;
  remindDays: number | null;
}

/** План урока: шаги по порядку и номер текущего, с нуля */
export interface LessonPlan {
  steps: string[];
  current: number;
}

export interface GroupDetails {
  classGoal: ClassGoal | null;
  plan: LessonPlan;
  group: {
    id: string;
    name: string;
    subtractTeacher: boolean;
    feedComments: boolean;
    archivedAt: string | null;
    isOwner: boolean;
    /** Когда удалятся фото и файлы архивной группы; у действующей null */
    filesExpireAt: string | null;
    /** Сколько дней файлы хранятся после переноса в архив */
    filesKeptDays: number;
  };
  students: LessonStudent[];
  reasons: Reason[];
  teams: Team[];
  /** Запросы наград, ждущие ответа */
  pendingRewards: number;
  /** Работы учеников, ждущие проверки */
  pendingWorks: number;
  /** Ответы на задания, ждущие проверки */
  pendingAnswers: number;
  todayAttendance: { peopleOnPhoto: number | null; presentStudentIds: string[] } | null;
}
