import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_HERO, levelForPoints } from '@heroes/shared';
import { HeroesProvider } from '../src/features/auth';
import { GroupSettingsModal } from '../src/features/groups/components/GroupSettingsModal';
import { HeroAvatar } from '../src/features/hero';
import { ProfileView } from '../src/features/profile/components/ProfileView';
import type { Profile } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const sum = { earned: 5, lost: 0, net: 5 };
const PROFILE: Profile = {
  works: [], badges: [], portfolio: [],
  student: {
    id: 's1', name: 'Маша Иванова', login: 'masha.i',
    group: { id: 'g1', name: 'ИВТ-21', archivedAt: null, parentsEnabled: false, heroes: false },
  },
  hero: { name: 'Гроза', parts: DEFAULT_HERO }, level: levelForPoints(5),
  points: { today: sum, week: sum, total: sum }, history: [], attendance: { attended: 0, total: 0, records: [] },
};

it('без героев вместо героя нейтральный силуэт', () => {
  const { container } = renderApp(<HeroesProvider on={false}><HeroAvatar parts={DEFAULT_HERO} title="Гроза" /></HeroesProvider>);
  expect(container.querySelector('svg[viewBox="0 0 200 240"]')).toBeNull();
  expect(screen.queryByRole('img', { name: 'Гроза' })).not.toBeInTheDocument();
});

it('профиль без героев: имя студента, баллы, без уровня и героя', () => {
  renderApp(<HeroesProvider on={false}><ProfileView profile={PROFILE} isOwn /></HeroesProvider>);
  expect(screen.getByRole('heading', { level: 1, name: 'Маша Иванова' })).toBeVisible();
  expect(screen.queryByText(/уровень:/)).not.toBeInTheDocument();
  expect(screen.queryByText('Гроза')).not.toBeInTheDocument();
  expect(screen.getByText('Всего')).toBeVisible();
});

it('в настройках группы выключаются герои и награды', async () => {
  const teachers = { owner: { id: 't1', name: 'Анна', login: 'anna' }, coTeachers: [] };
  api.mockImplementation(async (method) => (method === 'GET' ? teachers : {}) as never);
  renderInGroup(<GroupSettingsModal open onClose={() => undefined} />, groupData());
  const toggle = await screen.findByRole('checkbox', { name: 'Герои, питомцы, уровни и магазин наград' });
  await act(async () => fireEvent.click(toggle));
  expect(api).toHaveBeenCalledWith('PATCH', '/teacher/groups/g1', { heroes: false });
});
