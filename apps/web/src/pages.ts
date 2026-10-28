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
  login: remember(() => import('./pages/Login')),
  groups: remember(() => import('./pages/teacher/Groups')),
  groupLayout: remember(() => import('./pages/teacher/GroupLayout')),
  lesson: remember(() => import('./pages/teacher/Lesson')),
  students: remember(() => import('./pages/teacher/Students')),
  print: remember(() => import('./pages/teacher/Print')),
  reasons: remember(() => import('./pages/teacher/Reasons')),
  attendance: remember(() => import('./pages/teacher/Attendance')),
  stats: remember(() => import('./pages/teacher/Stats')),
  studentView: remember(() => import('./pages/teacher/StudentView')),
  settings: remember(() => import('./pages/teacher/Settings')),
  cabinet: remember(() => import('./pages/student/Cabinet')),
  myHero: remember(() => import('./pages/student/MyHero')),
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

export const LoginPage = page(loaders.login, 'LoginPage');
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

const byRole = {
  TEACHER: [loaders.groups, loaders.groupLayout, loaders.lesson, loaders.students, loaders.print, loaders.reasons, loaders.attendance, loaders.stats, loaders.studentView, loaders.settings],
  STUDENT: [loaders.cabinet, loaders.myHero],
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
export function preloadRoute(pathname: string): Promise<unknown> {
  return Promise.all(pagesFor(pathname).map((key) => loaders[key]().catch(() => undefined)));
}
