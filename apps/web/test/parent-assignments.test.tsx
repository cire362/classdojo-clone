import { screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ParentAssignments } from '../src/features/assignments/components/ParentAssignments';
import type { ParentAssignment } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const BASE = { description: '', dueOn: null, points: 0, createdAt: '2026-11-07T08:00:00.000Z', author: 'Анна Сергеевна', files: [] };
const LIST: ParentAssignment[] = [
  {
    ...BASE, id: 'a1', title: 'Нарисовать осень', status: 'RETURNED', overdue: true, comment: 'Добавь цвета', accepted: null,
    dueOn: '2026-11-05',
  },
  {
    ...BASE, id: 'a2', title: 'Выучить стих', points: 2, status: 'APPROVED', overdue: false, comment: 'Молодец!',
    accepted: {
      id: 'w1', title: 'Выучить стих', text: 'Выучила', status: 'APPROVED', comment: 'Молодец!', createdAt: BASE.createdAt,
      decidedAt: BASE.createdAt, decidedBy: 'Анна Сергеевна', files: [], unseen: false,
    },
  },
];

it('родитель видит состояние, срок и комментарий; ответ — только принятый', async () => {
  api.mockResolvedValue(LIST as never);
  renderApp(<ParentAssignments childId="s1" />);
  const list = await screen.findByRole('list', { name: 'Задания ребёнка' });
  expect(api).toHaveBeenCalledWith('GET', '/parent/children/s1/assignments');
  const [returned, accepted] = within(list).getAllByRole('listitem').filter((li) => li.parentElement === list);
  expect(within(returned).getByText('На доработке')).toBeVisible();
  expect(within(returned).getByText(/Срок прошёл/)).toBeVisible();
  expect(within(returned).getByText('Добавь цвета')).toBeVisible();
  expect(within(returned).queryByRole('region', { name: 'Принятый ответ' })).not.toBeInTheDocument();
  expect(within(accepted).getByText('Принято')).toBeVisible();
  expect(within(within(accepted).getByRole('region', { name: 'Принятый ответ' })).getByText('Выучила')).toBeVisible();
  expect(within(accepted).getAllByText('Молодец!')).toHaveLength(1);
});

it('пустой список', async () => {
  api.mockResolvedValue([] as never);
  renderApp(<ParentAssignments childId="s1" />);
  expect(await screen.findByText('Заданий пока нет')).toBeVisible();
});
