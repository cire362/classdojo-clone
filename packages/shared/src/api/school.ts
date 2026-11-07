/** Типы ответов API: лента школы */
import type { FileInfo } from './files.js';
import type { ClassGoal } from './groups.js';
import type { ChatMessage } from './messaging.js';

/** Запись ленты школы, как её видят преподаватели и родители */
export interface SchoolPost {
  id: string;
  /** Родитель может видеть несколько школ, если его дети учатся в разных */
  schoolName: string;
  author: string;
  text: string;
  /** Объявление всем семьям */
  important: boolean;
  createdAt: string;
  files: FileInfo[];
  /** Появилась после прошлого просмотра ленты */
  unread: boolean;
}

/**
 * Запись в панели учреждения: у объявления видно, сколько его читателей открыли ленту после публикации.
 * Читатели — семьи в школе и студенты в колледже и вузе
 */
export interface AdminSchoolPost extends Omit<SchoolPost, 'unread'> {
  reach: { read: number; total: number; audience: 'families' | 'students' } | null;
}

/** Переписка родителя с одной школой */
export interface ParentSchoolThread {
  schoolId: string;
  schoolName: string;
  messages: ChatMessage[];
}

/** Строка ящика школы: кто пишет и ждёт ли он ответа */
export interface InboxThread {
  id: string;
  /** Подпись семьи: дети в этой школе и их классы */
  family: string;
  lastText: string;
  lastFromSchool: boolean;
  lastMessageAt: string;
  waiting: boolean;
}

export interface InboxThreadDetail extends InboxThread {
  messages: ChatMessage[];
}

/** Общая причина школы в панели администрации */
export interface SchoolReason {
  id: string;
  name: string;
  emoji: string;
  value: number;
}

/** Общая цель школы: копят все классы плюсами, начисленными после запуска */
export type SchoolGoal = ClassGoal;

/** Строка рейтинга классов: только суммы класса, без отдельных детей */
export interface ClassRatingRow {
  groupId: string;
  groupName: string;
  teacherName: string;
  students: number;
  /** Плюсы класса за период и в среднем на ученика: так большой класс не выигрывает числом */
  earned: number;
  perStudent: number;
  place: number;
  /** Группа смотрящего преподавателя */
  mine: boolean;
}

export type RatingPeriod = 'week' | 'month';

export interface SchoolPoints {
  goal: SchoolGoal | null;
  period: RatingPeriod;
  /** Начало периода, ISO */
  from: string;
  rating: ClassRatingRow[];
}
