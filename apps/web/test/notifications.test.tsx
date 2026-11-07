import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useNotifications, NotificationsProvider } from '../src/features/notifications/notify';
import { StudentNotificationsPage } from '../src/pages/student/Notifications';
import type { Me, Notifications, StudentNotifications } from '../src/lib/api';
import { renderApp } from './render';

const auth = vi.hoisted(() => ({ user: { login: 'masha.i', role: 'STUDENT', name: 'Маша' } as Me | null }));
vi.mock('../src/features/auth/auth', async () => {
  const { termsFor } = await import('@heroes/shared/terms');
  return { useAuth: () => auth, useTerms: () => termsFor(auth.user?.institution), useHeroes: () => auth.user?.heroes ?? true };
});
vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const { api } = await import('../src/lib/api');

function page(): StudentNotifications {
  return {
    items: [{ id: 'reward:r1', kind: 'reward', title: 'Награда выдана', text: 'Выбрать место на уроке', author: 'Анна', cost: 15, href: '/shop', createdAt: '2026-10-29T10:00:00.000Z', unread: true }],
    through: '2026-10-29T10:01:00.000Z', groupId: 'g1', unreadCount: 1, nextCursor: null,
  };
}
beforeEach(() => { vi.mocked(api).mockReset(); auth.user = { login: 'masha.i', role: 'STUDENT', name: 'Маша' }; });

it('показывает награду и переход в магазин; чтение списка не отмечает его просмотренным', async () => {
  vi.mocked(api).mockResolvedValue(page());
  renderApp(<StudentNotificationsPage />);
  expect(await screen.findByText('Выбрать место на уроке')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'К наградам' })).toHaveAttribute('href', '/shop');
  expect(screen.getByText('Новое')).toBeInTheDocument();
  expect(api).not.toHaveBeenCalledWith('POST', expect.anything(), expect.anything());
});

it('сбой прочтения сохраняет счётчик; повтор передаёт исходный снимок и показывает новые события', async () => {
  const initial = page();
  let failed = true;
  let read = false;
  vi.mocked(api).mockImplementation(async (method) => {
    if (method === 'POST') {
      if (failed) { failed = false; throw new Error('Нет связи'); }
      read = true;
      return { ok: true };
    }
    return read ? { ...initial, items: [{ ...initial.items[0], unread: false }, { ...initial.items[0], id: 'reward:r2', text: 'Новая награда', unread: true }], unreadCount: 1 } : initial;
  });
  const { user } = renderApp(<StudentNotificationsPage />);
  await screen.findByText('Выбрать место на уроке');
  await user.click(screen.getByRole('button', { name: 'Прочитать все' }));
  expect(await screen.findByText('Нет связи')).toBeInTheDocument();
  expect(screen.getByText('Новое')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Прочитать все' }));
  expect(await screen.findByText('Новая награда')).toBeInTheDocument();
  expect(screen.getAllByText('Новое')).toHaveLength(1);
  expect(api).toHaveBeenCalledWith('POST', '/student/notifications/read', { groupId: 'g1', through: initial.through });
});

it('следующая страница сохраняет снимок и уже загруженную историю; ошибку можно повторить', async () => {
  const initial = { ...page(), nextCursor: 'cursor-1' };
  let failed = true;
  vi.mocked(api).mockImplementation(async (_method, path) => {
    if (!path.includes('?')) return initial;
    if (failed) { failed = false; throw new Error('Не удалось загрузить историю'); }
    return { ...initial, nextCursor: null, items: [{ ...initial.items[0], id: 'reward:r2', text: 'Ещё награда' }] };
  });
  const { user } = renderApp(<StudentNotificationsPage />);
  await user.click(await screen.findByRole('button', { name: 'Показать ещё' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить историю');
  expect(screen.getByText('Выбрать место на уроке')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Показать ещё' }));
  expect(await screen.findByText('Ещё награда')).toBeInTheDocument();
  expect(screen.getByText('Выбрать место на уроке')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('GET', `/student/notifications?${new URLSearchParams({ before: 'cursor-1', through: initial.through })}`);
  expect(screen.queryByRole('button', { name: 'Показать ещё' })).not.toBeInTheDocument();
});

it('пустая история объясняет, когда появятся события', async () => {
  vi.mocked(api).mockResolvedValue({ ...page(), items: [], unreadCount: 0 });
  renderApp(<StudentNotificationsPage />);
  expect(await screen.findByText('Пока тихо')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Прочитать все' })).toBeDisabled();
});

function Counters() {
  const { counts, refresh } = useNotifications();
  return <button onClick={() => void refresh()}>{counts.feed + counts.rewards}</button>;
}

it('поздний ответ старого запроса не возвращает уже прочитанные счётчики', async () => {
  let resolveOld!: (value: Notifications) => void;
  vi.mocked(api).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValue({ messages: 0, feed: 0, rewards: 0, works: 0, assignments: 0, school: 0, schoolInbox: 0 });
  const { user } = renderApp(<NotificationsProvider><Counters /></NotificationsProvider>);
  await user.click(screen.getByRole('button'));
  await act(async () => resolveOld({ messages: 0, feed: 4, rewards: 2, works: 0, assignments: 0, school: 0, schoolInbox: 0 }));
  expect(screen.getByRole('button')).toHaveTextContent('0');
});

it('смена входа не показывает счётчики прежнего ученика', async () => {
  let resolveOld!: (value: Notifications) => void;
  vi.mocked(api).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValue({ messages: 0, feed: 1, rewards: 0, works: 0, assignments: 0, school: 0, schoolInbox: 0 });
  const view = renderApp(<NotificationsProvider><Counters /></NotificationsProvider>);
  auth.user = { login: 'petya.s', role: 'STUDENT', name: 'Петя' };
  view.rerender(<NotificationsProvider><Counters /></NotificationsProvider>);
  await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('1'));
  await act(async () => resolveOld({ messages: 0, feed: 7, rewards: 5, works: 0, assignments: 0, school: 0, schoolInbox: 0 }));
  expect(screen.getByRole('button')).toHaveTextContent('1');
});

it('новая история при обновлении счётчика не заменяется поздним ответом прежнего запроса', async () => {
  let resolveOld!: (value: StudentNotifications) => void;
  let first = true;
  vi.mocked(api).mockImplementation(async (_method, path) => {
    if (path === '/notifications') return { messages: 0, feed: 0, rewards: 1, works: 0, assignments: 0 };
    if (first) { first = false; return new Promise((resolve) => { resolveOld = resolve; }); }
    return page();
  });
  renderApp(<NotificationsProvider><StudentNotificationsPage /></NotificationsProvider>);
  await screen.findByText('Выбрать место на уроке');
  await act(async () => resolveOld({ ...page(), items: [], unreadCount: 0 }));
  expect(screen.getByText('Выбрать место на уроке')).toBeInTheDocument();
  expect(screen.queryByText('Пока тихо')).not.toBeInTheDocument();
});

it('запоздалая страница истории не перезаписывает коллекцию с только что пришедшим уведомлением', async () => {
  let resolveMore!: (value: StudentNotifications) => void;
  let live = false;
  const initial = { ...page(), nextCursor: 'cursor-1' };
  const fresh = { ...page(), items: [{ ...page().items[0], id: 'reward:r2', text: 'Свежая награда' }] };
  vi.mocked(api).mockImplementation(async (_method, path) => {
    if (path === '/notifications') return { messages: 0, feed: 0, rewards: live ? 2 : 0 };
    if (path.includes('?')) return new Promise((resolve) => { resolveMore = resolve; });
    return live ? fresh : initial;
  });
  const { user } = renderApp(<NotificationsProvider><StudentNotificationsPage /></NotificationsProvider>);
  await user.click(await screen.findByRole('button', { name: 'Показать ещё' }));
  live = true;
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  await screen.findByText('Свежая награда');
  await act(async () => resolveMore({ ...page(), items: [{ ...page().items[0], id: 'reward:old', text: 'Поздняя страница истории' }] }));
  expect(screen.getByText('Свежая награда')).toBeInTheDocument();
  expect(screen.queryByText('Поздняя страница истории')).not.toBeInTheDocument();
});
