/** Типы ответов API: жалобы и журнал модерации ленты */
import type { ReportReason } from '../feed.js';

/** Запись или комментарий с открытыми жалобами, в очереди преподавателя */
export interface ReportedItem {
  target: 'post' | 'comment';
  id: string;
  postId: string;
  author: string;
  text: string;
  createdAt: string;
  hidden: boolean;
  /** По причинам: сколько жалоб с каждой */
  reasons: Partial<Record<ReportReason, number>>;
  /** Пояснения родителей, без имён: преподаватель решает по содержанию */
  notes: string[];
  reportedAt: string;
}

export type ModerationActionKind = 'report' | 'hide' | 'auto_hide' | 'unhide' | 'keep' | 'delete';

export interface ModerationEntry {
  id: string;
  action: ModerationActionKind;
  target: 'post' | 'comment';
  actor: string;
  excerpt: string;
  createdAt: string;
}

export interface Moderation {
  reports: ReportedItem[];
  log: ModerationEntry[];
}
