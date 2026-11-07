/**
 * Какие страницы (модули кода) нужны для адреса. Одна таблица для приложения (pages.ts)
 * и для раннего скрипта (early.ts), который заказывает код страницы ещё до запуска приложения.
 * Модуль без зависимостей: он встраивается в HTML.
 */
export const PAGE_MODULES = {
  admin: 'pages/admin/Admin.tsx',
  login: 'pages/Login.tsx',
  codeLogin: 'pages/CodeLogin.tsx',
  invite: 'pages/Invite.tsx',
  schoolJoin: 'pages/SchoolJoin.tsx',
  groups: 'pages/teacher/Groups.tsx',
  groupLayout: 'pages/teacher/GroupLayout.tsx',
  lesson: 'pages/teacher/Lesson.tsx',
  students: 'pages/teacher/Students.tsx',
  print: 'pages/teacher/Print.tsx',
  reasons: 'pages/teacher/Reasons.tsx',
  attendance: 'pages/teacher/Attendance.tsx',
  stats: 'pages/teacher/Stats.tsx',
  groupFeed: 'pages/teacher/Feed.tsx',
  groupCalendar: 'pages/teacher/Calendar.tsx',
  groupWorks: 'pages/teacher/Works.tsx',
  groupAssignments: 'pages/teacher/Assignments.tsx',
  rewards: 'pages/teacher/Rewards.tsx',
  rewardRequests: 'pages/teacher/RewardRequests.tsx',
  messages: 'pages/teacher/Messages.tsx',
  studentView: 'pages/teacher/StudentView.tsx',
  settings: 'pages/teacher/Settings.tsx',
  cabinet: 'pages/student/Cabinet.tsx',
  myHero: 'pages/student/MyHero.tsx',
  parentHome: 'pages/parent/ParentHome.tsx',
  studentFeed: 'pages/student/StudentFeed.tsx',
  studentCalendar: 'pages/student/Calendar.tsx',
  shop: 'pages/student/Shop.tsx',
  notifications: 'pages/student/Notifications.tsx',
  studentWorks: 'pages/student/Works.tsx',
  studentAssignments: 'pages/student/Assignments.tsx',
} as const;

export type PageKey = keyof typeof PAGE_MODULES;

const ROUTE_PAGES: [RegExp, PageKey[]][] = [
  [/^\/login$/, ['login']],
  [/^\/(q|join)$/, ['codeLogin']],
  [/^\/invite$/, ['invite']],
  [/^\/school-join$/, ['schoolJoin']],
  [/^\/$/, ['groups', 'cabinet', 'parentHome', 'admin']],
  [/^\/hero$/, ['myHero']],
  [/^\/settings$/, ['settings']],
  [/^\/s\//, ['studentView']],
  [/^\/g\/[^/]+\/print$/, ['print']],
  [/^\/g\/[^/]+\/attendance$/, ['groupLayout', 'attendance']],
  [/^\/g\/[^/]+\/students$/, ['groupLayout', 'students']],
  [/^\/g\/[^/]+\/reasons$/, ['groupLayout', 'reasons']],
  [/^\/g\/[^/]+\/stats$/, ['groupLayout', 'stats']],
  [/^\/g\/[^/]+\/feed$/, ['groupLayout', 'groupFeed']],
  [/^\/g\/[^/]+\/calendar$/, ['groupLayout', 'groupCalendar']],
  [/^\/g\/[^/]+\/rewards$/, ['groupLayout', 'rewards']],
  [/^\/g\/[^/]+\/works$/, ['groupLayout', 'groupWorks']],
  [/^\/g\/[^/]+\/assignments(\/[^/]+)?$/, ['groupLayout', 'groupAssignments']],
  [/^\/shop$/, ['shop']],
  [/^\/notifications$/, ['notifications']],
  [/^\/reward-requests$/, ['rewardRequests']],
  [/^\/messages(\/|$)/, ['messages']],
  [/^\/feed$/, ['studentFeed']],
  [/^\/calendar$/, ['studentCalendar']],
  [/^\/works$/, ['studentWorks']],
  [/^\/assignments$/, ['studentAssignments']],
  [/^\/g\/[^/]+\/?$/, ['groupLayout', 'lesson']],
];

/** Главная у каждой роли своя; если роль известна (запомнена после входа), грузим только её страницу */
const HOME_BY_ROLE: Record<string, PageKey> = { ADMIN: 'admin', TEACHER: 'groups', STUDENT: 'cabinet', PARENT: 'parentHome' };

export function pagesFor(pathname: string, role?: string | null): PageKey[] {
  if (pathname === '/' && role && HOME_BY_ROLE[role]) return [HOME_BY_ROLE[role]];
  return ROUTE_PAGES.find(([re]) => re.test(pathname))?.[1] ?? [];
}
