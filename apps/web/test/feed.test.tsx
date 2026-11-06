import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Feed } from '../src/features/feed/components/Feed';
import { GroupFeed } from '../src/features/feed/components/GroupFeed';
import type { FeedPost } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const POST: FeedPost = {
  id: 'p1', text: 'Экскурсия', media: [], createdAt: '2026-11-02T10:00:00.000Z', author: 'Анна Сергеевна', canDelete: true, pinned: false, scheduled: false,
  reactions: { like: 1, heart: 0, star: 0 }, myReaction: null, comments: [], canComment: true, canReact: true, canPin: true,
  hidden: false, reports: 0, canReport: false, reported: false, canModerate: true,
};
const COMMENT = { hidden: false, reports: 0, canReport: false, reported: false };
const EMPTY_QUEUE = { reports: [], log: [] };
const PATH = '/teacher/groups/g1/feed';
function reply(posts: FeedPost[], result?: Partial<FeedPost>) {
  api.mockImplementation(async (method, path) =>
    (path.endsWith('/moderation') ? EMPTY_QUEUE : method === 'GET' ? posts : { ...POST, ...result }) as never);
}
const render = (props: Partial<Parameters<typeof Feed>[0]> = {}) => renderApp(<Feed path={PATH} {...props} />);
const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole('button', { name }));

it('реакция ставится и снимается повторным нажатием', async () => {
  reply([POST], { myReaction: 'heart', reactions: { like: 1, heart: 1, star: 0 } });
  render();
  await click('С любовью: 0');
  expect(api).toHaveBeenCalledWith('PUT', `${PATH}/p1/reaction`, { kind: 'heart' });
  const pressed = await screen.findByRole('button', { name: 'С любовью: 1' });
  expect(pressed).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(pressed);
  expect(api).toHaveBeenLastCalledWith('PUT', `${PATH}/p1/reaction`, { kind: null });
});

it('комментарий отправляется и очищает поле; ошибка оставляет текст', async () => {
  const comment = { id: 'c1', author: 'Родитель: Маша И.', text: 'Спасибо', createdAt: POST.createdAt, canDelete: true, ...COMMENT };
  api.mockImplementation(async (method) => (method === 'GET' ? [POST] : { ...POST, comments: [comment] }) as never);
  render();
  const field = await screen.findByLabelText('Комментарий');
  fireEvent.change(field, { target: { value: '  Спасибо ' } });
  await click('Отправить');
  expect(await screen.findByRole('list', { name: 'Комментарии' })).toHaveTextContent('Родитель: Маша И.');
  expect(api).toHaveBeenCalledWith('POST', `${PATH}/p1/comments`, { text: 'Спасибо' });
  expect(field).toHaveValue('');
  api.mockRejectedValueOnce(new Error('Преподаватель отключил комментарии в этой группе'));
  fireEvent.change(field, { target: { value: 'Ещё' } });
  await click('Отправить');
  expect(await screen.findByText('Преподаватель отключил комментарии в этой группе')).toBeVisible();
  expect(field).toHaveValue('Ещё');
});

it('комментарий удаляется, если это разрешено', async () => {
  const mine = { id: 'c1', author: 'Я', text: 'Мой', createdAt: POST.createdAt, canDelete: true, ...COMMENT };
  const other = { id: 'c2', author: 'Другой', text: 'Чужой', createdAt: POST.createdAt, canDelete: false, ...COMMENT };
  api.mockImplementation(async (method) => (method === 'GET' ? [{ ...POST, comments: [mine, other] }] : { ...POST, comments: [other] }) as never);
  render();
  expect(await screen.findAllByRole('button', { name: 'Удалить комментарий' })).toHaveLength(1);
  await click('Удалить комментарий');
  expect(api).toHaveBeenCalledWith('DELETE', `${PATH}/p1/comments/c1`);
  expect(await screen.findByText('Чужой')).toBeVisible();
  expect(screen.queryByText('Мой')).not.toBeInTheDocument();
});

it('закрепление и подпись на записи', async () => {
  reply([POST], { pinned: true });
  render();
  await click('Закрепить запись');
  expect(api).toHaveBeenCalledWith('PUT', `${PATH}/p1/pin`, { pinned: true });
  expect(await screen.findByText('Закреплено')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Открепить запись' })).toBeVisible();
});

it('ученик и родитель не видят управления записью', async () => {
  reply([{ ...POST, canDelete: false, canPin: false, canComment: false }]);
  render();
  expect(await screen.findByText('Экскурсия')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Закрепить|Удалить/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Комментарий')).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Реакции' })).toBeVisible();
});

it('отложенная запись помечена, реакций и комментариев у неё нет', async () => {
  reply([{ ...POST, scheduled: true, canReact: false, canComment: false }]);
  render();
  expect(await screen.findByText('Выйдет в это время')).toBeVisible();
  expect(screen.queryByRole('group', { name: 'Реакции' })).not.toBeInTheDocument();
});

it('публикацию можно запланировать: без даты кнопка закрыта', async () => {
  reply([], { scheduled: true });
  render({ postTo: PATH });
  fireEvent.change(await screen.findByLabelText('Объявление для учеников и родителей'), { target: { value: 'Завтра экскурсия' } });
  fireEvent.click(screen.getByLabelText('Опубликовать позже'));
  expect(screen.getByRole('button', { name: 'Запланировать' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Дата и время публикации'), { target: { value: '2030-01-15T09:30' } });
  await click('Запланировать');
  const [, , body] = api.mock.calls.find(([method]) => method === 'POST')!;
  expect(body).toEqual({ text: 'Завтра экскурсия', publishAt: new Date('2030-01-15T09:30').toISOString() });
  expect(await screen.findByText('Выйдет в это время')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeVisible();
});

it('обычная публикация уходит без времени', async () => {
  reply([]);
  render({ postTo: PATH });
  fireEvent.change(await screen.findByLabelText('Объявление для учеников и родителей'), { target: { value: 'Сейчас' } });
  await click('Опубликовать');
  expect(api).toHaveBeenCalledWith('POST', PATH, { text: 'Сейчас', publishAt: undefined });
});

it('переключатель комментариев сохраняется на группе и перечитывает ленту', async () => {
  reply([POST]);
  renderInGroup(<GroupFeed />, groupData());
  const toggle = await screen.findByRole('checkbox', { name: 'Комментарии родителей' });
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  await vi.waitFor(() => expect(api).toHaveBeenCalledWith('PATCH', '/teacher/groups/g1', { feedComments: false }));
  await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: 'Комментарии родителей' })).not.toBeChecked());
  expect(api.mock.calls.filter(([method]) => method === 'GET').length).toBeGreaterThan(1);
});

it('в архивной группе нет ни формы, ни переключателя', async () => {
  reply([{ ...POST, canComment: false, canReact: false, canPin: false, canDelete: false }]);
  renderInGroup(<GroupFeed />, groupData({ archivedAt: '2026-10-01T00:00:00.000Z' }));
  const group = await screen.findByRole('group', { name: 'Реакции' });
  expect(within(group).getByRole('button', { name: 'Нравится: 1' })).toBeDisabled();
  expect(screen.queryByLabelText('Объявление для учеников и родителей')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Комментарии родителей' })).not.toBeInTheDocument();
});
