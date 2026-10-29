/**
 * Какие страницы (модули кода) нужны для адреса. Одна таблица для приложения (pages.ts)
 * и для раннего скрипта (early.ts), который заказывает код страницы ещё до запуска приложения.
 * Модуль без зависимостей: он встраивается в HTML.
 */
export const PAGE_MODULES = {
  login: 'pages/Login.tsx',
  groups: 'pages/teacher/Groups.tsx',
  groupLayout: 'pages/teacher/GroupLayout.tsx',
  lesson: 'pages/teacher/Lesson.tsx',
  students: 'pages/teacher/Students.tsx',
  print: 'pages/teacher/Print.tsx',
  reasons: 'pages/teacher/Reasons.tsx',
  attendance: 'pages/teacher/Attendance.tsx',
  stats: 'pages/teacher/Stats.tsx',
  groupFeed: 'pages/teacher/Feed.tsx',
  messages: 'pages/teacher/Messages.tsx',
  studentView: 'pages/teacher/StudentView.tsx',
  settings: 'pages/teacher/Settings.tsx',
  cabinet: 'pages/student/Cabinet.tsx',
  myHero: 'pages/student/MyHero.tsx',
  parentHome: 'pages/parent/ParentHome.tsx',
  studentFeed: 'pages/student/StudentFeed.tsx',
} as const;

export type PageKey = keyof typeof PAGE_MODULES;

const ROUTE_PAGES: [RegExp, PageKey[]][] = [
  [/^\/login$/, ['login']],
  [/^\/$/, ['groups', 'cabinet', 'parentHome']],
  [/^\/hero$/, ['myHero']],
  [/^\/settings$/, ['settings']],
  [/^\/s\//, ['studentView']],
  [/^\/g\/[^/]+\/print$/, ['print']],
  [/^\/g\/[^/]+\/attendance$/, ['groupLayout', 'attendance']],
  [/^\/g\/[^/]+\/students$/, ['groupLayout', 'students']],
  [/^\/g\/[^/]+\/reasons$/, ['groupLayout', 'reasons']],
  [/^\/g\/[^/]+\/stats$/, ['groupLayout', 'stats']],
  [/^\/g\/[^/]+\/feed$/, ['groupLayout', 'groupFeed']],
  [/^\/messages(\/|$)/, ['messages']],
  [/^\/feed$/, ['studentFeed']],
  [/^\/g\/[^/]+\/?$/, ['groupLayout', 'lesson']],
];

/** Главная у каждой роли своя; если роль известна (запомнена после входа), грузим только её страницу */
const HOME_BY_ROLE: Record<string, PageKey> = { TEACHER: 'groups', STUDENT: 'cabinet', PARENT: 'parentHome' };

export function pagesFor(pathname: string, role?: string | null): PageKey[] {
  if (pathname === '/' && role && HOME_BY_ROLE[role]) return [HOME_BY_ROLE[role]];
  return ROUTE_PAGES.find(([re]) => re.test(pathname))?.[1] ?? [];
}
