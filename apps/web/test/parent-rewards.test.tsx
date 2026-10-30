import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ParentRewards } from '../src/components/ParentRewards';
import { api, type ParentRewards as Rewards, type RewardRequest } from '../src/api';
import { renderApp } from './render';

vi.mock('../src/api', () => ({ api: vi.fn() }));
const request = (id: string, status: RewardRequest['status']): RewardRequest => ({ id, title: `Награда ${id}`, emoji: '🎁', cost: 5, status, createdAt: '2026-10-30T10:00:00.000Z', decidedAt: status === 'PENDING' ? null : '2026-10-31T10:00:00.000Z' });
const data = (patch: Partial<Rewards> = {}): Rewards => ({ student: { id: 's1', name: 'Маша Иванова', groupName: '5 «А»' }, balance: 10, archived: false, pending: [request('p', 'PENDING')], history: [request('a', 'APPROVED'), request('r', 'REJECTED')], rewards: [{ id: 'rw', title: 'Выбрать игру', emoji: '🎁', cost: 15 }], nextCursor: null, ...patch });
beforeEach(() => { vi.mocked(api).mockReset(); });

it('показывает баланс, состояния и каталог без действий за ребёнка', async () => {
  vi.mocked(api).mockResolvedValue(data());
  const { user } = renderApp(<ParentRewards childId="s1" />);
  await screen.findByText('Маша Иванова, 5 «А»');
  expect(screen.getByText('10 баллов')).toBeVisible();
  for (const status of ['Ждёт ответа', 'Выдано', 'Отказано', 'Баллы возвращены.']) expect(screen.getByText(status)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Попросить|Выдать|Отменить|Отказать/ })).not.toBeInTheDocument();
  await user.click(screen.getByText('Награды группы (1)'));
  expect(screen.getByText('Выбрать игру')).toBeVisible();
  expect(vi.mocked(api).mock.calls.every(([method]) => method === 'GET')).toBe(true);
});

it('повторяет загрузку после ошибки и объясняет пустой архивный магазин', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('Нет связи')).mockResolvedValue(data({ pending: [], history: [], rewards: [], archived: true }));
  const { user } = renderApp(<ParentRewards childId="s1" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи');
  await user.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByText('Решений пока нет')).toBeVisible();
  expect(screen.getByText(/Группа в архиве/)).toBeVisible();
  expect(screen.getByText('Ожидающих запросов нет.')).toBeVisible();
  await user.click(screen.getByText('Награды группы (0)'));
  expect(screen.getByText('Преподаватель пока не добавил награды для этой группы.')).toBeVisible();
});

it('ошибка следующей страницы допускает повтор, дубли не добавляются', async () => {
  let fail = true;
  vi.mocked(api).mockImplementation(async (_method, path) => {
    if (!path.includes('?')) return data({ nextCursor: 'cursor' });
    if (fail) { fail = false; throw new Error('Страница не загрузилась'); }
    return data({ history: [request('a', 'APPROVED'), request('old', 'APPROVED')] });
  });
  const { user } = renderApp(<ParentRewards childId="s1" />);
  await user.click(await screen.findByRole('button', { name: 'Показать ещё' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Страница не загрузилась');
  await user.click(screen.getByRole('button', { name: 'Показать ещё' }));
  expect(await screen.findByText('Награда old')).toBeVisible();
  expect(screen.getAllByText('Награда a')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Показать ещё' })).not.toBeInTheDocument();
});

it('запоздалая история не подменяет обновлённые решения и баланс', async () => {
  let resolveOld!: (value: Rewards) => void;
  let refreshed = false;
  vi.mocked(api).mockImplementation(async (_method, path) => path.includes('?') ? new Promise<Rewards>((resolve) => { resolveOld = resolve; }) : data(refreshed ? { balance: 3, history: [request('fresh', 'APPROVED')], nextCursor: null } : { nextCursor: 'cursor' }));
  const { user } = renderApp(<ParentRewards childId="s1" />);
  await user.click(await screen.findByRole('button', { name: 'Показать ещё' }));
  refreshed = true;
  await user.click(screen.getByRole('button', { name: 'Обновить' }));
  await screen.findByText('Награда fresh');
  await act(async () => resolveOld(data({ history: [request('old', 'APPROVED')] })));
  expect(screen.queryByText('Награда old')).not.toBeInTheDocument();
  expect(screen.getByText('3 балла')).toBeVisible();
});

it('смена ребёнка не показывает чужие данные, возвращение на вкладку обновляет выбранного', async () => {
  let resolveOld!: (value: Rewards) => void;
  vi.mocked(api).mockImplementation(async (_method, path) => path.includes('/s1/') ? new Promise<Rewards>((resolve) => { resolveOld = resolve; }) : data({ student: { id: 's2', name: 'Ваня Иванов', groupName: '6 «Б»' }, pending: [], history: [] }));
  const view = renderApp(<ParentRewards key="s1" childId="s1" />);
  await waitFor(() => expect(resolveOld).toBeDefined());
  view.rerender(<ParentRewards key="s2" childId="s2" />);
  await screen.findByText('Ваня Иванов, 6 «Б»');
  await act(async () => resolveOld(data()));
  const region = screen.getByRole('region', { name: 'Награды ребёнка' });
  expect(within(region).queryByText('Награда p')).not.toBeInTheDocument();
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(api).toHaveBeenLastCalledWith('GET', '/parent/children/s2/rewards');
});
