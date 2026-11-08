import { useState } from 'react';
import { useLoad } from '../../../lib/hooks';
import { useNotifications } from '../../notifications';
import { AdminSchoolFeed } from '../../schoolfeed';
import { SchoolInbox } from '../../schoolinbox';
import { SchoolPointsPanel } from '../../schoolpoints';
import { Departments } from '../../departments';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchSchool } from '../api';
import { cap, termsFor, type Terms } from '@heroes/shared/terms';
import { TermsProvider, useOptionalAuth } from '../../auth';
import { canManageTeachers } from '../roles';
import { PasswordCard } from './PasswordCard';
import { SchoolGroups } from './SchoolGroups';
import { SchoolStaff } from './SchoolStaff';
import { SchoolTeachers } from './SchoolTeachers';
import { SchoolTitle } from './SchoolTitle';
import { TeacherRequests } from './TeacherRequests';
import { AdminSubjects } from '../../subjects';
import { LeaderDashboard } from '../../dashboard';

type Tab = 'teachers' | 'overview' | 'inbox' | 'groups' | 'departments' | 'subjects' | 'points' | 'feed' | 'staff' | 'password';
const tabs = (t: Terms): [Tab, string][] => [
  ['teachers', 'Преподаватели'],
  ['overview', 'Обзор'],
  ['inbox', `Ящик ${t.org.one.gen}`],
  ['groups', `${cap(t.group.many.nom)} ${t.org.one.gen}`],
  ...(t.kind === 'SCHOOL' ? [] : [['departments', cap(t.department.many.nom)] as [Tab, string]]),
  ['subjects', cap(t.subject.many.nom)],
  ['points', `Баллы ${t.org.one.gen}`],
  ['feed', `Лента ${t.org.one.gen}`],
  ['staff', 'Администрация'],
  ['password', 'Мой пароль'],
];

function TabBadge({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <span className="chip ml-2 min-w-6 justify-center bg-accent px-1.5 text-xs text-on-accent">
      {count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/**
 * Администрация учреждения: преподаватели, группы и состав администрации своего учреждения. Других она не видит.
 * Что можно менять, зависит от должности: руководитель — всё, заместитель — преподавателей, сотрудник только смотрит.
 * Слова раздела берутся из словаря типа учреждения и меняются сразу после смены типа
 */
export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('teachers');
  const { data: school, setData, error, reload } = useLoad(() => fetchSchool(), []);
  const { counts } = useNotifications();
  const auth = useOptionalAuth();
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!school) return <Skeleton className="h-64" />;
  // Сотрудник подразделения ведёт свои группы, но не управляет учреждением
  const manager = canManageTeachers(school.role) && !school.department;
  const groupEditor = school.role !== 'STAFF';
  const terms = termsFor(school.kind);
  return (
    <TermsProvider kind={school.kind}>
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-soft">
          {school.department ? `${terms.departmentHead}: ${school.department.name}` : terms.roles[school.role]}
        </p>
        <SchoolTitle
          school={school}
          onChange={(next) => {
            setData(next);
            if (next.kind !== school.kind) void auth?.refresh();
          }}
        />
      </div>
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Разделы">
        {tabs(terms).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'teachers' && <TabBadge count={school.pendingTeachers} label="ждут проверки" />}
            {key === 'inbox' && <TabBadge count={counts.schoolInbox} label="ждут ответа" />}
          </button>
        ))}
      </nav>
      {tab === 'teachers' && (
        <div className="space-y-6">
          {manager && (
            <TeacherRequests
              joinCode={school.joinCode}
              onChange={(joinCode, pendingTeachers) => setData({ ...school, joinCode, pendingTeachers })}
            />
          )}
          <SchoolTeachers key={school.pendingTeachers} canManage={manager} />
        </div>
      )}
      {tab === 'inbox' && <SchoolInbox />}
      {tab === 'groups' && <SchoolGroups canExport={groupEditor} departmentId={school.department?.id ?? null} />}
      {tab === 'departments' && <Departments canEdit={manager} />}
      {tab === 'subjects' && <AdminSubjects canEdit={manager} />}
      {tab === 'overview' && <LeaderDashboard />}
      {tab === 'points' && <SchoolPointsPanel canEdit={manager} />}
      {tab === 'feed' && <AdminSchoolFeed canWrite={manager} />}
      {tab === 'staff' && <SchoolStaff isDirector={school.role === 'DIRECTOR'} />}
      {tab === 'password' && <div className="max-w-2xl"><PasswordCard endpoint="/admin/me/password" /></div>}
    </div>
    </TermsProvider>
  );
}
