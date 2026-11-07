import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TermsProvider } from '../src/features/auth';
import { GroupSettingsModal } from '../src/features/groups/components/GroupSettingsModal';
import { AdminSchoolFeed } from '../src/features/schoolfeed/components/AdminSchoolFeed';
import { StudentsManager } from '../src/features/students/components/StudentsManager';
import type { AdminSchoolPost } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const TEACHERS = { owner: { id: 't1', name: 'Анна', login: 'anna' }, coTeachers: [] };

it('владелец группы выключает родителей в настройках', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? TEACHERS : {}) as never);
  renderInGroup(<GroupSettingsModal open onClose={() => undefined} />, groupData());
  const toggle = await screen.findByRole('checkbox', { name: 'Входы родителей' });
  expect(toggle).toBeChecked();
  await act(async () => fireEvent.click(toggle));
  expect(api).toHaveBeenCalledWith('PATCH', '/teacher/groups/g1', { parentsEnabled: false });
});

it('без родителей в группе нет кнопки выдачи входов родителям', async () => {
  api.mockResolvedValue([] as never);
  const data = groupData({ parentsEnabled: false });
  renderInGroup(<TermsProvider kind="UNIVERSITY"><StudentsManager /></TermsProvider>, data, 'students');
  expect(await screen.findByText('2 студента')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Входы родителям/ })).not.toBeInTheDocument();
});

it('в вузе объявление считает прочитавших студентов', async () => {
  const post: AdminSchoolPost = {
    id: 'p1', schoolName: 'Политех', author: 'Ректор', text: 'Сессия', important: true, createdAt: '2026-11-07T08:00:00.000Z', files: [],
    reach: { read: 12, total: 40, audience: 'students' },
  };
  api.mockResolvedValue([post] as never);
  renderApp(<TermsProvider kind="UNIVERSITY"><AdminSchoolFeed canWrite /></TermsProvider>);
  expect(await screen.findByText('Прочитали 12 из 40 студентов')).toBeVisible();
  expect(screen.getByText('Объявление для всех студентов')).toBeVisible();
});
