/** Типы ответов API: лента школы */
import type { FileInfo } from './files.js';
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

/** Запись в панели школы: у объявления видно, сколько семей его прочитали */
export interface AdminSchoolPost extends Omit<SchoolPost, 'unread'> {
  reach: { read: number; families: number } | null;
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
