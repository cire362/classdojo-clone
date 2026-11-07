/** Типы ответов API: счётчики, уведомления ученика, лента и переписка */
import type { ReactionKind } from '../feed.js';
import type { FileInfo } from './files.js';

/** Счётчики: новые сообщения, записи в ленте, выданные награды, решения по работам и задания ученика */
export interface Notifications {
  messages: number;
  feed: number;
  rewards: number;
  works: number;
  /** Новые задания и новые решения по ответам на них */
  assignments: number;
  /** Новые записи ленты школы: у преподавателя и родителя */
  school: number;
  /** Ящик школы: у родителя — новые ответы школы, у администрации — переписки, ждущие ответа */
  schoolInbox: number;
}

export interface StudentNotification {
  id: string;
  kind: 'feed' | 'reward';
  title: string;
  text: string;
  author: string | null;
  cost: number | null;
  createdAt: string;
  unread: boolean;
  href: '/feed' | '/shop';
}

export interface StudentNotifications {
  items: StudentNotification[];
  nextCursor: string | null;
  through: string;
  groupId: string;
  unreadCount: number;
}

export interface FeedComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  canDelete: boolean;
  /** Скрыт: его видят только преподаватели группы */
  hidden: boolean;
  /** Открытые жалобы; видны только преподавателям, остальным 0 */
  reports: number;
  /** Может пожаловаться: родитель на чужой комментарий, пока не жаловался */
  canReport: boolean;
  reported: boolean;
}

export interface FeedPost {
  id: string;
  text: string;
  /** Фото и видео по порядку: GET /api/files/:id, превью фото и обложка видео — ?size=preview */
  media: { id: string; kind: 'photo' | 'video' }[];
  /** Момент публикации; у отложенной записи он в будущем */
  createdAt: string;
  author: string;
  canDelete: boolean;
  pinned: boolean;
  /** Отложена: её пока видят только преподаватели группы */
  scheduled: boolean;
  reactions: Record<ReactionKind, number>;
  myReaction: ReactionKind | null;
  /** Ученикам комментарии не показываются */
  comments: FeedComment[];
  /** Что этот зритель может сделать с записью сейчас */
  canComment: boolean;
  canReact: boolean;
  canPin: boolean;
  /** Скрыта: её видят только преподаватели группы */
  hidden: boolean;
  /** Открытые жалобы на запись; видны только преподавателям */
  reports: number;
  canReport: boolean;
  /** Этот зритель уже пожаловался */
  reported: boolean;
  /** Преподаватель может скрыть запись и комментарии и вернуть их */
  canModerate: boolean;
}

export interface ChatMessage {
  id: string;
  /** Пустой, если в сообщении только файлы */
  text: string;
  /** Фото и PDF: GET /api/files/:id, превью фото — ?size=preview */
  files: FileInfo[];
  createdAt: string;
  mine: boolean;
  author: string;
  fromParent: boolean;
  /** Отложено: родитель пока не видит; момент отправки в createdAt */
  scheduled: boolean;
}

/** Тихие часы преподавателя, «ЧЧ:ММ» по времени школы */
export interface QuietHours {
  from: string;
  to: string;
}

/** Подсказка родителю: все преподаватели группы сейчас в тихих часах */
export interface ParentNotice {
  quietUntil: string | null;
}

/** Переписка с родителем в списке у преподавателя */
export interface ThreadSummary {
  studentId: string;
  parentId: string;
  studentName: string;
  groupName: string;
  parentLogin: string;
  lastText: string;
  lastAt: string;
  unread: number;
}

export interface TeacherThread {
  studentName: string;
  group: { id: string; name: string; archivedAt: string | null };
  parentLogin: string;
  messages: ChatMessage[];
}
