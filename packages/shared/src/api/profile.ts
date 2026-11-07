/** Типы ответов API: герой, профиль ученика и кабинет родителя */
import type { StudentBadge } from '../badges.js';
import type { HeroParts } from '../hero/catalog.js';
import type { LevelInfo } from '../levels.js';
import type { Notifications } from './messaging.js';
import type { StudentWork } from './works.js';

export interface Hero {
  name: string;
  parts: HeroParts;
}

export interface PointsSum {
  earned: number;
  lost: number;
  net: number;
}

export interface HistoryEvent {
  /** Имя начислившего преподавателя; null для старой записи без автора */
  author: string | null;
  id: string;
  value: number;
  reasonName: string;
  emoji: string;
  createdAt: string;
  /** Баллы за посещение: меняются только через отметку посещаемости */
  attendance: boolean;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  emoji: string;
  createdAt: string;
  author: string;
}

export interface Profile {
  /** Открыта ли премиум-коллекция деталей героя */
  premium: boolean;
  portfolio: PortfolioItem[];
  /** Одобренные работы ученика, новые сверху */
  works: StudentWork[];
  badges: StudentBadge[];
  student: {
    id: string; name: string; login: string;
    group: { id: string; name: string; archivedAt: string | null; parentsEnabled: boolean };
  };
  hero: Hero;
  level: LevelInfo;
  points: { today: PointsSum; week: PointsSum; total: PointsSum };
  history: HistoryEvent[];
  attendance: { attended: number; total: number; records: { date: string; lesson: number; present: boolean }[] };
}

export interface StudentNews {
  level: number;
  title: string;
  levelUp: { from: number; to: number } | null;
  newPartIds: string[];
}

export interface WeeklySummary {
  studentId: string;
  from: string;
  to: string;
  currentFrom: string;
  previousWeek: string;
  nextWeek: string | null;
  isCurrent: boolean;
  points: PointsSum & { events: number };
  reasons: { name: string; emoji: string; earned: number; lost: number; count: number }[];
  attendance: {
    total: number;
    attended: number;
    missed: number;
    records: { id: string; date: string; lesson: number; present: boolean; groupName: string }[];
  };
}

/** Ребёнок в кабинете родителя */
export interface ParentChild {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  hero: Hero;
  level: number;
  unread: Pick<Notifications, 'messages' | 'feed'>;
}
