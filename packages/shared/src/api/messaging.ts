/** Типы ответов API: счётчики, уведомления ученика, лента и переписка */

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

export interface FeedPost {
  id: string;
  text: string;
  createdAt: string;
  author: string;
  canDelete: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  createdAt: string;
  mine: boolean;
  author: string;
  fromParent: boolean;
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
