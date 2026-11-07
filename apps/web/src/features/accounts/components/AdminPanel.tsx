import { useState } from 'react';
import { useLoad } from '../../../lib/hooks';
import { AdminSchoolFeed } from '../../schoolfeed';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchSchool } from '../api';
import { ROLE_NAMES, canManageTeachers } from '../roles';
import { PasswordCard } from './PasswordCard';
import { SchoolGroups } from './SchoolGroups';
import { SchoolStaff } from './SchoolStaff';
import { SchoolTeachers } from './SchoolTeachers';
import { SchoolTitle } from './SchoolTitle';
import { TeacherRequests } from './TeacherRequests';

type Tab = 'teachers' | 'groups' | 'feed' | 'staff' | 'password';
const TABS: [Tab, string][] = [
  ['teachers', 'Преподаватели'],
  ['groups', 'Группы школы'],
  ['feed', 'Лента школы'],
  ['staff', 'Администрация'],
  ['password', 'Мой пароль'],
];

/**
 * Администрация школы: преподаватели, группы и состав администрации своей школы. Других школ она не видит.
 * Что можно менять, зависит от должности: директор — всё, завуч — преподавателей, сотрудник только смотрит
 */
export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('teachers');
  const { data: school, setData, error, reload } = useLoad(() => fetchSchool(), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!school) return <Skeleton className="h-64" />;
  const manager = canManageTeachers(school.role);
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-soft">{ROLE_NAMES[school.role]}</p>
        <SchoolTitle school={school} onRenamed={setData} />
      </div>
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Разделы школы">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'teachers' && school.pendingTeachers > 0 && (
              <span className="chip ml-2 min-w-6 justify-center bg-accent px-1.5 text-xs text-on-accent">
                {school.pendingTeachers}
                <span className="sr-only"> ждут проверки</span>
              </span>
            )}
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
      {tab === 'groups' && <SchoolGroups canExport={manager} />}
      {tab === 'feed' && <AdminSchoolFeed canWrite={manager} />}
      {tab === 'staff' && <SchoolStaff isDirector={school.role === 'DIRECTOR'} />}
      {tab === 'password' && <div className="max-w-2xl"><PasswordCard endpoint="/admin/me/password" /></div>}
    </div>
  );
}
