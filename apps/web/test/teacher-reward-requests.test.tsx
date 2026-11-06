import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppLayout } from '../src/app/Layout';
import { RewardRequestsPage } from '../src/pages/teacher/RewardRequests';
import { RewardsPage } from '../src/pages/teacher/Rewards';
import { NotificationsProvider } from '../src/features/notifications/notify';
import type { Me } from '../src/lib/api';
import { renderApp } from './render';
import { groupData, renderInGroup } from './group-harness';

const auth = vi.hoisted(() => ({ user: { login: 'teacher', role: 'TEACHER', name: 'Анна' } as Me, logout: vi.fn() }));
vi.mock('../src/features/auth/auth', () => ({ useAuth: () => auth }));
vi.mock('../src/features/news/news', () => ({ useNews: () => ({ news: null }) }));
vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const { api } = await import('../src/lib/api');
beforeEach(() => { vi.mocked(api).mockReset(); auth.user = { login: 'teacher', role: 'TEACHER', name: 'Анна' }; });

it('в шапке есть переход с точным счётчиком, а при нуле остаётся доступная ссылка', async () => {
  let rewards = 3;
  vi.mocked(api).mockImplementation(async () => ({ messages: 0, feed: 0, rewards }));
  const { user } = renderApp(<NotificationsProvider><AppLayout /></NotificationsProvider>);
  const link = await screen.findByRole('link', { name: 'Запросы наград 3 ожидающих запроса' });
  expect(link).toHaveAttribute('href', '/reward-requests');
  await user.click(link);
  rewards = 0;
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  await screen.findByRole('link', { name: 'Запросы наград' });
  expect(screen.queryByText('3')).not.toBeInTheDocument();
});

it('ученик не видит общую очередь преподавателя', () => {
  auth.user = { login: 'masha', role: 'STUDENT', name: 'Маша' };
  renderApp(<AppLayout />);
  expect(screen.queryByRole('link', { name: /Запросы наград/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Награды' })).toHaveLength(2);
});

it('список групп восстанавливается после ошибки, а обновление показывает пустую очередь', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('Нет связи')).mockResolvedValueOnce({ groups: [{ id: 'g1', name: '5 «А»', count: 2 }], total: 2 }).mockResolvedValue({ groups: [], total: 0 });
  const { user } = renderApp(<RewardRequestsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи');
  await user.click(screen.getByRole('button', { name: /Повторить/ }));
  expect(await screen.findByRole('link', { name: '5 «А» 2 запроса ждут ответа' })).toHaveAttribute('href', '/g/g1/rewards');
  await user.click(screen.getByRole('button', { name: 'Обновить' }));
  expect(await screen.findByText('Ожидающих запросов нет')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('опрос обновляет распределение даже при прежнем общем числе запросов', async () => {
  let group = 'Первая группа';
  vi.mocked(api).mockImplementation(async (_method, path) => path === '/notifications' ? { messages: 0, feed: 0, rewards: 1, works: 0, assignments: 0 } : { groups: [{ id: 'g1', name: group, count: 1 }], total: 1 });
  renderApp(<NotificationsProvider><RewardRequestsPage /></NotificationsProvider>);
  await screen.findByRole('link', { name: /Первая группа/ });
  group = 'Вторая группа';
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(await screen.findByRole('link', { name: /Вторая группа/ })).toBeInTheDocument();
  expect(screen.queryByText('Первая группа')).not.toBeInTheDocument();
});

it('решение по запросу сразу обновляет общий счётчик', async () => {
  const pending = { id: 'r1', title: 'Место на уроке', emoji: '🎁', cost: 1, status: 'PENDING', createdAt: '2026-10-30T10:00:00Z', student: { id: 's1', name: 'Маша' } };
  let decided = false;
  vi.mocked(api).mockImplementation(async (method, path) => {
    if (path === '/notifications') return { messages: 0, feed: 0, rewards: decided ? 0 : 1 };
    if (method === 'POST') { decided = true; return [{ ...pending, status: 'APPROVED' }]; }
    return { rewards: [], requests: [pending] };
  });
  const { user } = renderInGroup(<NotificationsProvider><RewardsPage /></NotificationsProvider>, groupData(), 'rewards');
  await user.click(await screen.findByRole('button', { name: 'Выдать' }));
  await screen.findByText('Новых запросов нет');
  await waitFor(() => expect(vi.mocked(api).mock.calls.filter((c) => c[1] === '/notifications')).toHaveLength(2));
});
