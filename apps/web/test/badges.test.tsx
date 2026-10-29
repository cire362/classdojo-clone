import { expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { BADGES, DEFAULT_HERO, levelForPoints, type StudentBadge } from '@heroes/shared';
import { BadgeSummary, Badges } from '../src/components/Badges';
import { ProfileView } from '../src/components/ProfileView';
import { ReasonsPage } from '../src/pages/teacher/Reasons';
import type { Profile } from '../src/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/api', async (orig) => ({ ...(await orig<typeof import('../src/api')>()), api: vi.fn() }));
const { api } = await import('../src/api');
const badges = (): StudentBadge[] => BADGES.map((b) => ({ ...b, progress: b.id === 'help.20' ? 19 : 0, earnedOn: null, note: null, groupName: null }));

it('закрытый значок показывает доступный прогресс, полученный — дату и группу', () => {
  const items = badges();
  items[2] = { ...items[2], progress: 1, earnedOn: '2026-10-29', groupName: '5 «А»' };
  renderApp(<Badges badges={items} />);
  expect(screen.getByRole('progressbar', { name: 'Надёжный друг' })).toHaveAttribute('aria-valuetext', '19 из 20');
  expect(screen.getByRole('progressbar', { name: 'Надёжный друг' })).toHaveAttribute('aria-valuenow', '95');
  expect(screen.getByText('Группа: 5 «А»')).toBeInTheDocument();
  expect(screen.getByText(/Получен .*29/)).toBeInTheDocument();
  expect(screen.queryByRole('progressbar', { name: 'Первый герой класса' })).not.toBeInTheDocument();
});

it('пустая коллекция приглашает открыть условия; сводка не показывает закрытые значки как полученные', async () => {
  const open = vi.fn();
  const { user } = renderApp(<BadgeSummary badges={badges()} onOpen={open} />);
  expect(screen.getByRole('heading')).toHaveTextContent('0 из 3');
  expect(screen.queryByText('Надёжный друг')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Все значки' }));
  expect(open).toHaveBeenCalledOnce();
});

it('из профиля открывается портфолио с автоматическими значками и отдельными достижениями учителя', async () => {
  const sum = { earned: 0, lost: 0, net: 0 };
  const profile: Profile = { premium: true, badges: badges(), portfolio: [{ id: 'p1', title: 'Призёр олимпиады', emoji: '🏆', description: '', author: 'Учитель', createdAt: '2026-10-29T10:00:00Z' }], student: { id: 's1', name: 'Маша Иванова', login: 'masha.i', group: { id: 'g1', name: '5 «А»', archivedAt: null } }, hero: { name: '', parts: DEFAULT_HERO }, level: levelForPoints(0), points: { today: sum, week: sum, total: sum }, history: [], attendance: { attended: 0, total: 0, records: [] } };
  const { user } = renderApp(<ProfileView profile={profile} isOwn />);
  await user.click(screen.getByRole('button', { name: 'Все значки' }));
  expect(screen.getByRole('tab', { name: /Портфолио/ })).toHaveAttribute('aria-selected', 'true');
  expect(within(screen.getByRole('region', { name: 'Условия получения значков' })).getByText('Надёжный друг')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Достижения от преподавателя' })).getByText('Призёр олимпиады')).toBeInTheDocument();
});

it('свою положительную причину можно отметить как помощь; изменение отправляется на сервер', async () => {
  vi.mocked(api).mockReset().mockResolvedValue({});
  const { user } = renderInGroup(<ReasonsPage />, groupData(), 'reasons');
  await user.click(screen.getByRole('button', { name: 'Новая причина' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Название'), 'Объяснил задачу');
  await user.click(dialog.getByRole('checkbox', { name: 'Учитывать для значка «Надёжный друг»' }));
  await user.click(dialog.getByRole('button', { name: 'Сохранить' }));
  expect(api).toHaveBeenCalledWith('POST', '/teacher/groups/g1/reasons', expect.objectContaining({ name: 'Объяснил задачу', countsForHelpBadge: true }));
});
