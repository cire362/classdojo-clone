import type { HeroParts, LevelInfo, StudentBadge } from '@heroes/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Ранние запросы: при старте приложения данные открытой страницы запрашиваются сразу,
 * параллельно с загрузкой кода (см. preloadRoute). Первый же api() с тем же GET-путём
 * забирает готовый ответ. Ответ используется один раз и только пока он свежий.
 */
const EARLY_TTL_MS = 15_000;
type EarlyMap = Map<string, { at: number; response: Promise<Response | null> }>;
// Общая карта с src/early.ts, который запускается раньше всего приложения
const early: EarlyMap = ((window as Window & { __heroesEarly?: EarlyMap }).__heroesEarly ??= new Map());

export function prefetchGet(path: string): void {
  if (early.has(path)) return;
  early.set(path, {
    at: Date.now(),
    response: fetch(`/api${path}`, { credentials: 'same-origin' }).catch(() => null),
  });
}

function takeEarly(path: string): Promise<Response | null> | null {
  const hit = early.get(path);
  if (!hit) return null;
  early.delete(path);
  return Date.now() - hit.at < EARLY_TTL_MS ? hit.response : null;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Heroes-Client': '1' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response | null = method === 'GET' ? await (takeEarly(path) ?? Promise.resolve(null)) : null;
  if (!res) {
    try {
      res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет');
    }
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('heroes:unauthorized'));
    throw new ApiError(res.status, data?.error ?? `Ошибка ${res.status}`);
  }
  return data as T;
}

export type Role = 'TEACHER' | 'STUDENT' | 'PARENT' | 'ADMIN';
export interface Me {
  login: string;
  role: Role;
  name: string;
}

export interface Hero {
  name: string;
  parts: HeroParts;
}

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

export interface Reward {
  id: string;
  title: string;
  emoji: string;
  cost: number;
}

export interface RewardRequest {
  id: string;
  title: string;
  emoji: string;
  cost: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  decidedAt: string | null;
  student?: { id: string; name: string };
}

export interface Shop {
  balance: number;
  archived: boolean;
  rewards: Reward[];
  requests: RewardRequest[];
}

export interface ParentRewards {
  student: { id: string; name: string; groupName: string };
  balance: number;
  archived: boolean;
  rewards: Reward[];
  pending: RewardRequest[];
  history: RewardRequest[];
  nextCursor: string | null;
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

export interface Credentials {
  id: string;
  name: string;
  login: string;
  password: string;
}

/** Родительский вход, привязанный к ученику */
export interface ParentAccess {
  id: string;
  login: string;
  /** Другие дети этого родителя (общий вход для братьев и сестёр) */
  otherChildren: { id: string; name: string }[];
}

export interface ParentCredentials {
  parentId: string;
  studentId: string;
  studentName: string;
  login: string;
  password: string;
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

/** Счётчики: новые сообщения, записи в ленте и выданные награды ученика */
export interface Notifications {
  messages: number;
  feed: number;
  rewards: number;
}

export interface PendingRewardGroups {
  groups: { id: string; name: string; count: number }[];
  total: number;
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
  badges: StudentBadge[];
  student: { id: string; name: string; login: string; group: { id: string; name: string; archivedAt: string | null } };
  hero: Hero;
  level: LevelInfo;
  points: { today: PointsSum; week: PointsSum; total: PointsSum };
  history: HistoryEvent[];
  attendance: { attended: number; total: number; records: { date: string; lesson: number; present: boolean }[] };
}

export interface Detection {
  count: number;
  width: number;
  height: number;
  boxes: { x: number; y: number; w: number; h: number; score: number }[];
  elapsedMs: number;
}

export interface WeeklyStats {
  groupId: string;
  from: string;
  to: string;
  scope: { kind: 'group' | 'student' | 'team'; id: string; name: string };
  members: number;
  points: PointsSum & { events: number };
  weeks: ({ week: string; from: string; to: string; partial: boolean; events: number } & PointsSum)[];
}

export interface Stats {
  from: string;
  to: string;
  students: {
    id: string;
    name: string;
    login: string;
    earned: number;
    lost: number;
    net: number;
    level: number;
    attended: number;
    sessions: number;
    attendanceRate: number | null;
  }[];
  sessions: {
    id: string;
    date: string;
    lesson: number;
    peopleOnPhoto: number | null;
    subtractedTeacher: boolean;
    presentCount: number;
    studentsTotal: number;
  }[];
}

export interface StudentNews {
  level: number;
  title: string;
  levelUp: { from: number; to: number } | null;
  newPartIds: string[];
}

export interface AttendanceDay {
  date: string;
  lesson: number;
  lessons: { lesson: number; presentCount: number; studentsTotal: number; peopleOnPhoto: number | null }[];
  session: {
    peopleOnPhoto: number | null;
    subtractedTeacher: boolean;
    presentStudentIds: string[];
    markedStudentIds: string[];
  } | null;
}

export interface TeacherCredentials { id: string; name: string; login: string; password: string }
export interface AdminTeacher {
  id: string; name: string; login: string; ownedGroups: number; sharedGroups: number;
  premiumUntil: string | null; premiumActive: boolean;
}
export interface AdminTeachers { freeForAll: boolean; teachers: AdminTeacher[] }
export interface AdminGroup {
  id: string; name: string; archivedAt: string | null; studentsCount: number;
  owner: { id: string; name: string; login: string };
  colleagues: { id: string; name: string }[];
}
