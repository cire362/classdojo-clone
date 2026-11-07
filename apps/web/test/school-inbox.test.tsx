import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { pagesFor } from '../src/app/routes';
import { ParentSchoolMessages } from '../src/features/schoolinbox/components/ParentSchoolMessages';
import { SchoolInbox } from '../src/features/schoolinbox/components/SchoolInbox';
import type { ChatMessage, InboxThread, InboxThreadDetail } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const QUESTION: ChatMessage = {
  id: 'm1', text: 'Маша болела, справка', files: [], createdAt: '2026-11-07T08:00:00.000Z', mine: false,
  author: 'Родитель', fromParent: true, scheduled: false,
};
const ANSWER: ChatMessage = {
  ...QUESTION, id: 'm2', text: 'Спасибо, передали', mine: true, author: 'Ольга, администрация школы', fromParent: false,
};
const ROW: InboxThread = {
  id: 't1', family: 'Родитель: Маша Иванова (3 «А»)', lastText: QUESTION.text, lastFromSchool: false,
  lastMessageAt: QUESTION.createdAt, waiting: true,
};

it('адрес письма в школу', () => {
  expect(pagesFor('/school-messages')).toEqual(['schoolMessages']);
});

it('ящик: ждущие ответа отмечены; сотрудник открывает переписку, отвечает и ожидание снимается', async () => {
  const detail: InboxThreadDetail = { ...ROW, messages: [QUESTION] };
  api.mockImplementation(async (method, path) => {
    if (path === '/admin/inbox') return [ROW, { ...ROW, id: 't2', family: 'Родитель: Петя (5 «Б»)', waiting: false }] as never;
    if (method === 'GET') return detail as never;
    return { ...detail, waiting: false, lastFromSchool: true, messages: [QUESTION, ANSWER] } as never;
  });
  renderApp(<SchoolInbox />);
  const list = await screen.findByRole('list', { name: 'Переписки с семьями' });
  const [first, second] = within(list).getAllByRole('button');
  expect(within(first).getByText('Ждёт ответа')).toBeVisible();
  expect(within(second).queryByText('Ждёт ответа')).not.toBeInTheDocument();
  expect(screen.getByText('(ждут ответа: 1)')).toBeVisible();

  fireEvent.click(first);
  expect(await screen.findByRole('heading', { name: ROW.family })).toBeVisible();
  expect(screen.getByRole('button', { name: /Решено без ответа/ })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Спасибо, передали' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Отправить' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/inbox/t1', { text: 'Спасибо, передали', sendAt: undefined });
  expect(screen.getByText('Спасибо, передали')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Решено без ответа/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Уйдёт в это время')).not.toBeInTheDocument();
});

it('вопрос можно отметить решённым без письма', async () => {
  api.mockImplementation(async (method, path) => {
    if (path === '/admin/inbox') return [ROW] as never;
    if (method === 'GET') return { ...ROW, messages: [QUESTION] } as never;
    return { ...ROW, waiting: false, messages: [QUESTION] } as never;
  });
  renderApp(<SchoolInbox />);
  fireEvent.click(await screen.findByRole('button', { name: /Маша Иванова/ }));
  const handled = await screen.findByRole('button', { name: /Решено без ответа/ });
  await act(async () => fireEvent.click(handled));
  expect(api).toHaveBeenCalledWith('POST', '/admin/inbox/t1/handled');
  expect(await screen.findByText('Вопрос отмечен решённым')).toBeVisible();
});

it('родитель пишет в школу: у каждой школы своя переписка и своё поле', async () => {
  api.mockImplementation(async (method) => (method === 'GET'
    ? [
      { schoolId: 's1', schoolName: 'Гимназия № 5', messages: [] },
      { schoolId: 's2', schoolName: 'Школа № 2', messages: [{ ...ANSWER, mine: false }] },
    ]
    : [{ ...QUESTION, mine: true }]) as never);
  renderApp(<ParentSchoolMessages />);
  const gym = await screen.findByRole('region', { name: 'Гимназия № 5' });
  const second = screen.getByRole('region', { name: 'Школа № 2' });
  expect(within(second).getByText('Ольга, администрация школы')).toBeVisible();
  expect(new Set(screen.getAllByLabelText('Сообщение').map((f) => f.id)).size).toBe(2);
  fireEvent.change(within(gym).getByLabelText('Сообщение'), { target: { value: 'Маша болела, справка' } });
  await act(async () => fireEvent.click(within(gym).getByRole('button', { name: 'Отправить' })));
  expect(api).toHaveBeenCalledWith('POST', '/parent/school-messages/s1', { text: 'Маша болела, справка', sendAt: undefined });
  expect(within(gym).getByText('Маша болела, справка')).toBeVisible();
});
