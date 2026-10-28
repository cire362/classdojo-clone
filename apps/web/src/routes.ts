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
  studentView: 'pages/teacher/StudentView.tsx',
  settings: 'pages/teacher/Settings.tsx',
  cabinet: 'pages/student/Cabinet.tsx',
  myHero: 'pages/student/MyHero.tsx',
} as const;

export type PageKey = keyof typeof PAGE_MODULES;

const ROUTE_PAGES: [RegExp, PageKey[]][] = [
  [/^\/login$/, ['login']],
  [/^\/$/, ['groups', 'cabinet']],
  [/^\/hero$/, ['myHero']],
  [/^\/settings$/, ['settings']],
  [/^\/s\//, ['studentView']],
  [/^\/g\/[^/]+\/print$/, ['print']],
  [/^\/g\/[^/]+\/attendance$/, ['groupLayout', 'attendance']],
  [/^\/g\/[^/]+\/students$/, ['groupLayout', 'students']],
  [/^\/g\/[^/]+\/reasons$/, ['groupLayout', 'reasons']],
  [/^\/g\/[^/]+\/stats$/, ['groupLayout', 'stats']],
  [/^\/g\/[^/]+\/?$/, ['groupLayout', 'lesson']],
];

export function pagesFor(pathname: string): PageKey[] {
  return ROUTE_PAGES.find(([re]) => re.test(pathname))?.[1] ?? [];
}
