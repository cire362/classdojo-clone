import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Feed } from '../src/features/feed/components/Feed';
import { GroupFeed } from '../src/features/feed/components/GroupFeed';
import type { FeedComment, FeedPost, Moderation } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const CREATED = '2026-11-02T10:00:00.000Z';
const COMMENT: FeedComment = {
  id: 'c1', author: 'Родитель: Петя С.', text: 'Грубость', createdAt: CREATED, canDelete: false,
  hidden: false, reports: 0, canReport: true, reported: false,
};
const POST: FeedPost = {
  id: 'p1', text: 'Итоги четверти', media: [], createdAt: CREATED, author: 'Анна Сергеевна', canDelete: false, pinned: false,
  scheduled: false, reactions: { like: 0, heart: 0, star: 0 }, myReaction: null, comments: [COMMENT], canComment: true,
  canReact: true, canPin: false, hidden: false, reports: 0, canReport: true, reported: false, canModerate: false,
};
const PARENT = '/parent/children/s1/feed';
const QUEUE: Moderation = {
  reports: [{
    target: 'comment', id: 'c1', postId: 'p1', author: 'Родитель: Петя С.', text: 'Грубость', createdAt: CREATED, hidden: false,
    reasons: { insult: 2 }, notes: ['Обижает детей'], reportedAt: CREATED,
  }],
  log: [{ id: 'l1', action: 'report', target: 'comment', actor: 'Родитель: Маша И.', excerpt: 'Грубость', createdAt: CREATED }],
};
const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole('button', { name }));

it('родитель жалуется на комментарий: без причины отправить нельзя, после — отметка «Вы пожаловались»', async () => {
  const reported = { ...POST, comments: [{ ...COMMENT, canReport: false, reported: true }] };
  api.mockImplementation(async (method) => (method === 'GET' ? [POST] : { post: reported }) as never);
  renderApp(<Feed path={PARENT} />);
  await click('Пожаловаться на комментарий');
  const dialog = await screen.findByRole('dialog', { name: 'Жалоба на комментарий' });
  expect(within(dialog).getByRole('button', { name: 'Отправить жалобу' })).toBeDisabled();
  fireEvent.click(within(dialog).getByLabelText('Грубость или оскорбление'));
  fireEvent.change(within(dialog).getByLabelText('Пояснение, если нужно'), { target: { value: ' Обижает детей ' } });
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Отправить жалобу' })));
  expect(api).toHaveBeenCalledWith('POST', `${PARENT}/p1/reports`, { reason: 'insult', note: 'Обижает детей', commentId: 'c1' });
  expect(await screen.findByText('Жалоба отправлена. Преподаватель разберётся')).toBeVisible();
  expect(screen.getByText('Вы пожаловались')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Пожаловаться на комментарий' })).not.toBeInTheDocument();
});

it('жалоба, которая скрыла запись, убирает её из ленты родителя', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? [POST] : { post: null }) as never);
  renderApp(<Feed path={PARENT} />);
  await click('Пожаловаться на запись');
  fireEvent.click(await screen.findByLabelText('Личные данные или фото ребёнка'));
  await act(async () => click('Отправить жалобу'));
  expect(api).toHaveBeenCalledWith('POST', `${PARENT}/p1/reports`, { reason: 'personal', note: '', commentId: undefined });
  expect(await screen.findByText('Жалоба отправлена. Запись скрыта до решения преподавателя')).toBeVisible();
  expect(screen.queryByText('Итоги четверти')).not.toBeInTheDocument();
});

function teacher(queue: Moderation = QUEUE) {
  const post = { ...POST, canModerate: true, canReport: false, comments: [{ ...COMMENT, canReport: false, reports: 2 }] };
  api.mockImplementation(async (method, path) => {
    if (path.endsWith('/moderation')) return queue as never;
    if (method === 'PUT') return { reports: [], log: queue.log } as never;
    return [post] as never;
  });
  renderInGroup(<GroupFeed />, groupData());
}
const gets = (suffix: string) => api.mock.calls.filter(([method, path]) => method === 'GET' && path.endsWith(suffix)).length;

it('преподаватель разбирает жалобу в панели: причины, пояснения, скрытие перечитывает ленту', async () => {
  teacher();
  const panel = await screen.findByRole('region', { name: 'Жалобы родителей: 1' });
  expect(within(panel).getByText('Грубость или оскорбление: 2')).toBeVisible();
  expect(within(panel).getByText('Обижает детей')).toBeVisible();
  expect(await screen.findByText('Жалобы: 2')).toBeVisible();
  const before = gets('/feed');
  await act(async () => fireEvent.click(within(panel).getByRole('button', { name: 'Скрыть' })));
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/moderation/comment/c1', { hidden: true });
  expect(await screen.findByText('Скрыто от учеников и родителей')).toBeVisible();
  expect(screen.queryByRole('region', { name: /Жалобы родителей/ })).not.toBeInTheDocument();
  await vi.waitFor(() => expect(gets('/feed')).toBeGreaterThan(before));
});

it('запись скрывается прямо из ленты, панель жалоб перечитывается; журнал открывается', async () => {
  teacher({ reports: [], log: QUEUE.log });
  await click('Скрыть запись');
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/moderation/post/p1', { hidden: true });
  expect(await screen.findByText('Скрыта от учеников и родителей')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Показать запись' })).toBeVisible();
  await vi.waitFor(() => expect(gets('/moderation')).toBe(2));

  await click('Журнал модерации');
  const log = await screen.findByRole('dialog', { name: 'Журнал модерации' });
  expect(within(log).getByText('Жалоба')).toBeVisible();
  expect(within(log).getByText(/комментарий · Родитель: Маша И\./)).toBeVisible();
});
