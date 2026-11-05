import { useState, type ReactElement } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { DEFAULT_HERO } from '@heroes/shared';
import type { GroupDetails } from '../src/lib/api';
import type { GroupCtx } from '../src/features/groups';
import { renderApp } from './render';

export function groupData(overrides: Partial<GroupDetails['group']> = {}): GroupDetails {
  return {
    group: { id: 'g1', name: '5 «А»', subtractTeacher: true, feedComments: true, archivedAt: null, isOwner: true, ...overrides },
    students: [
      { id: 's1', name: 'Маша Иванова', login: 'masha.i', hero: { name: '', parts: DEFAULT_HERO }, todayEarned: 0, totalEarned: 4, level: 1, parentsCount: 0, teamId: null,
        noPhotos: false },
      { id: 's2', name: 'Петя Смирнов', login: 'petya.s', hero: { name: '', parts: DEFAULT_HERO }, todayEarned: 1, totalEarned: 9, level: 1, parentsCount: 1, teamId: null,
        noPhotos: true },
    ],
    reasons: [
      { id: 'r1', name: 'Отличная работа', emoji: '⭐', value: 2 },
      { id: 'r2', name: 'Опоздал', emoji: '⏰', value: -1 },
    ],
    classGoal: null,
    plan: { steps: [], current: 0 },
    teams: [],
    pendingRewards: 0,
    todayAttendance: null,
  };
}

function Where() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

/** Страница группы внутри контекста, как её даёт GroupLayout */
export function renderInGroup(page: ReactElement, initial: GroupDetails, path = '') {
  const reload = async () => {};
  function Layout() {
    const [data, setData] = useState<GroupDetails | null>(initial);
    if (!data) return null;
    return <Outlet context={{ data, setData, reload } satisfies GroupCtx} />;
  }
  return renderApp(
    <>
      <Routes>
        <Route path="/g/:groupId" element={<Layout />}>
          <Route index={!path} path={path || undefined} element={page} />
        </Route>
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </>,
    { route: `/g/g1${path ? `/${path}` : ''}` },
  );
}
