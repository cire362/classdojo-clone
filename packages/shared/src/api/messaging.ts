/** Типы ответов API: счётчики, уведомления ученика, лента и переписка */
import type { ReactionKind } from '../feed.js';
import type { FileInfo } from './files.js';

/** Счётчики: новые сообщения, записи в ленте и выданные награды ученика */
export interface Notifications {
  messages: number;
  feed: number;
  rewards: number;
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
