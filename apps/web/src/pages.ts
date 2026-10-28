import { lazy, type ComponentType } from 'react';

/**
 * Страницы загружаются по требованию: ученик не скачивает экраны преподавателя и наоборот.
 * После входа страницы своей роли подгружаются в фоне (prefetchPages), чтобы вкладки
 * открывались мгновенно и даже при пропавшем интернете.
 */
const loaders = {
  login: () => import('./pages/Login'),
  groups: () => import('./pages/teacher/Groups'),
  groupLayout: () => import('./pages/teacher/GroupLayout'),
  lesson: () => import('./pages/teacher/Lesson'),
  students: () => import('./pages/teacher/Students'),
  print: () => import('./pages/teacher/Print'),
  reasons: () => import('./pages/teacher/Reasons'),
  attendance: () => import('./pages/teacher/Attendance'),
  stats: () => import('./pages/teacher/Stats'),
  studentView: () => import('./pages/teacher/StudentView'),
  settings: () => import('./pages/teacher/Settings'),
  cabinet: () => import('./pages/student/Cabinet'),
  myHero: () => import('./pages/student/MyHero'),
};

function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
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
export function preloadRoute(pathname: string) {
  const routes: [RegExp, (() => Promise<unknown>)[]][] = [
    [/^\/login$/, [loaders.login]],
    [/^\/$/, [loaders.groups, loaders.cabinet]],
    [/^\/hero$/, [loaders.myHero]],
    [/^\/settings$/, [loaders.settings]],
    [/^\/s\//, [loaders.studentView]],
    [/^\/g\/[^/]+\/print$/, [loaders.print]],
    [/^\/g\/[^/]+\/attendance$/, [loaders.groupLayout, loaders.attendance]],
    [/^\/g\/[^/]+\/students$/, [loaders.groupLayout, loaders.students]],
    [/^\/g\/[^/]+\/reasons$/, [loaders.groupLayout, loaders.reasons]],
    [/^\/g\/[^/]+\/stats$/, [loaders.groupLayout, loaders.stats]],
    [/^\/g\/[^/]+\/?$/, [loaders.groupLayout, loaders.lesson]],
  ];
  const match = routes.find(([re]) => re.test(pathname));
  match?.[1].forEach((load) => load().catch(() => undefined));
}
