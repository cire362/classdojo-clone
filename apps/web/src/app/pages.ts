import { createElement, lazy, type ComponentType } from 'react';
import { pagesFor, type PageKey } from './routes';

/**
 * Страницы загружаются по требованию: ученик не скачивает экраны преподавателя и наоборот.
 * После входа страницы своей роли подгружаются в фоне (prefetchPages), чтобы вкладки
 * открывались мгновенно и даже при пропавшем интернете.
 */
// Загруженные модули страниц: как только модуль пришёл (по требованию, ранней или фоновой
// подгрузкой), страница дальше рисуется без Suspense
const resolved = new Map<() => Promise<unknown>, unknown>();

function remember<M>(load: () => Promise<M>): () => Promise<M> {
  const wrapped = () =>
    load().then((m) => {
      resolved.set(wrapped, m);
      return m;
    });
  return wrapped;
}

const loaders: Record<PageKey, () => Promise<any>> = {
  admin: remember(() => import('../pages/admin/Admin')),
  login: remember(() => import('../pages/Login')),
  codeLogin: remember(() => import('../pages/CodeLogin')),
  invite: remember(() => import('../pages/Invite')),
  groups: remember(() => import('../pages/teacher/Groups')),
  groupLayout: remember(() => import('../pages/teacher/GroupLayout')),
  lesson: remember(() => import('../pages/teacher/Lesson')),
  students: remember(() => import('../pages/teacher/Students')),
  print: remember(() => import('../pages/teacher/Print')),
  reasons: remember(() => import('../pages/teacher/Reasons')),
  attendance: remember(() => import('../pages/teacher/Attendance')),
  stats: remember(() => import('../pages/teacher/Stats')),
  groupFeed: remember(() => import('../pages/teacher/Feed')),
  groupCalendar: remember(() => import('../pages/teacher/Calendar')),
  groupWorks: remember(() => import('../pages/teacher/Works')),
  rewards: remember(() => import('../pages/teacher/Rewards')),
  rewardRequests: remember(() => import('../pages/teacher/RewardRequests')),
  messages: remember(() => import('../pages/teacher/Messages')),
  studentView: remember(() => import('../pages/teacher/StudentView')),
  settings: remember(() => import('../pages/teacher/Settings')),
  cabinet: remember(() => import('../pages/student/Cabinet')),
  myHero: remember(() => import('../pages/student/MyHero')),
  parentHome: remember(() => import('../pages/parent/ParentHome')),
  studentFeed: remember(() => import('../pages/student/StudentFeed')),
  studentCalendar: remember(() => import('../pages/student/Calendar')),
  shop: remember(() => import('../pages/student/Shop')),
  notifications: remember(() => import('../pages/student/Notifications')),
  studentWorks: remember(() => import('../pages/student/Works')),
};

/**
 * Ленивая страница без лишней заглушки: если модуль уже загружен, страница рисуется сразу,
 * иначе — через React.lazy и Suspense. Это важно: React 19 после показа заглушки
 * придерживает готовое содержимое ~300 мс, а вложенные Suspense складывают задержки.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  const Lazy = lazy(async () => ({ default: (await load())[name] as ComponentType }));
  function Page(props: Record<string, never>) {
    const m = resolved.get(load) as M | undefined;
    return m ? createElement(m[name] as ComponentType, props) : createElement(Lazy, props);
  }
  Page.displayName = `Page(${String(name)})`;
  return Page;
}

export const AdminPage = page(loaders.admin, 'AdminPage');
export const LoginPage = page(loaders.login, 'LoginPage');
export const QrLoginPage = page(loaders.codeLogin, 'QrLoginPage');
export const JoinClassPage = page(loaders.codeLogin, 'JoinClassPage');
export const InvitePage = page(loaders.invite, 'InvitePage');
export const GroupsPage = page(loaders.groups, 'GroupsPage');
export const GroupLayout = page(loaders.groupLayout, 'GroupLayout');
export const LessonPage = page(loaders.lesson, 'LessonPage');
export const StudentsPage = page(loaders.students, 'StudentsPage');
export const PrintPage = page(loaders.print, 'PrintPage');
export const ReasonsPage = page(loaders.reasons, 'ReasonsPage');
export const AttendancePage = page(loaders.attendance, 'AttendancePage');
export const StatsPage = page(loaders.stats, 'StatsPage');
export const StudentViewPage = page(loaders.studentView, 'StudentViewPage');
export const StudentHeroPage = page(loaders.studentView, 'StudentHeroPage');
export const SettingsPage = page(loaders.settings, 'SettingsPage');
export const CabinetPage = page(loaders.cabinet, 'CabinetPage');
export const MyHeroPage = page(loaders.myHero, 'MyHeroPage');
export const ParentHomePage = page(loaders.parentHome, 'ParentHomePage');
export const GroupFeedPage = page(loaders.groupFeed, 'GroupFeedPage');
export const GroupCalendarPage = page(loaders.groupCalendar, 'GroupCalendarPage');
export const StudentCalendarPage = page(loaders.studentCalendar, 'StudentCalendarPage');
export const MessagesPage = page(loaders.messages, 'MessagesPage');
export const ThreadPage = page(loaders.messages, 'ThreadPage');
export const StudentFeedPage = page(loaders.studentFeed, 'StudentFeedPage');
export const RewardsPage = page(loaders.rewards, 'RewardsPage');
export const RewardRequestsPage = page(loaders.rewardRequests, 'RewardRequestsPage');
export const ShopPage = page(loaders.shop, 'ShopPage');
export const StudentNotificationsPage = page(loaders.notifications, 'StudentNotificationsPage');
export const StudentWorksPage = page(loaders.studentWorks, 'StudentWorksPage');
export const GroupWorksPage = page(loaders.groupWorks, 'GroupWorksPage');

const byRole = {
  ADMIN: [loaders.admin],
  TEACHER: [
    loaders.groups, loaders.groupLayout, loaders.lesson, loaders.students, loaders.print, loaders.reasons,
    loaders.attendance, loaders.stats, loaders.studentView, loaders.settings, loaders.groupFeed, loaders.groupCalendar,
    loaders.messages, loaders.rewards, loaders.rewardRequests, loaders.groupWorks,
  ],
  STUDENT: [
    loaders.cabinet, loaders.myHero, loaders.studentFeed, loaders.studentCalendar,
    loaders.shop, loaders.notifications, loaders.studentWorks,
  ],
  PARENT: [loaders.parentHome],
};

const prefetched = new Set<string>();

/**
 * Фоновая подгрузка страниц роли. Начинаем после загрузки текущей страницы и паузы,
 * чтобы не отнимать канал у того, что пользователь ждёт прямо сейчас.
 */
export function prefetchPages(role: keyof typeof byRole) {
  if (prefetched.has(role)) return;
  prefetched.add(role);
  const run = () => byRole[role].forEach((load) => load().catch(() => prefetched.delete(role)));
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  const later = () => setTimeout(() => (idle ? idle(run, { timeout: 5000 }) : run()), 3000);
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
}

/** Код открытой страницы начинаем грузить сразу при старте, не дожидаясь проверки входа */
export function preloadRoute(pathname: string, role?: string | null): Promise<unknown> {
  return Promise.all(pagesFor(pathname, role).map((key) => loaders[key]().catch(() => undefined)));
}
