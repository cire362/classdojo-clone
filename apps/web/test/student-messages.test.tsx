import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { pagesFor } from '../src/app/routes';
import { TermsProvider } from '../src/features/auth';
import { MessageThreads } from '../src/features/messages/components/MessageThreads';
import { StudentMessages } from '../src/features/messages/components/StudentMessages';
import type { ChatMessage, ThreadSummary } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

it('адрес сообщений студента', () => {
  expect(pagesFor('/chat')).toEqual(['studentChat']);
});

it('у преподавателя ветка студента подписана и ведёт на свою страницу', async () => {
  const rows: ThreadSummary[] = [
    {
      studentId: 's1', parentId: null, studentName: 'Маша Иванова', groupName: 'ИВТ-21', parentLogin: null, lastText: 'Вопрос',
      lastAt: '2026-11-07T08:00:00.000Z', unread: 1,
    },
    {
      studentId: 's2', parentId: 'p2', studentName: 'Петя', groupName: 'ИВТ-21', parentLogin: 'petya.p', lastText: 'Привет',
      lastAt: '2026-11-06T08:00:00.000Z', unread: 0,
    },
  ];
  api.mockResolvedValue(rows as never);
  renderApp(<TermsProvider kind="UNIVERSITY"><MessageThreads /></TermsProvider>);
  expect(await screen.findByRole('link', { name: /Студент: Маша Иванова/ })).toHaveAttribute('href', '/messages/s1/student');
  expect(screen.getByRole('link', { name: /Родители: Петя/ })).toHaveAttribute('href', '/messages/s2/p2');
});

it('студент пишет преподавателям группы', async () => {
  const sent: ChatMessage = {
    id: 'm1', text: 'Можно сдать позже?', files: [], createdAt: '2026-11-07T08:00:00.000Z', mine: true, author: 'Студент',
    fromParent: false, scheduled: false,
  };
  api.mockImplementation(async (method) => (method === 'GET' ? [] : [sent]) as never);
  renderApp(<StudentMessages />);
  expect(await screen.findByText('Напишите преподавателям группы: ответ придёт сюда.')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Можно сдать позже?' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Отправить' })));
  expect(api).toHaveBeenCalledWith('POST', '/student/messages', { text: 'Можно сдать позже?', sendAt: undefined });
  expect(screen.getByText('Можно сдать позже?')).toBeVisible();
  expect(screen.queryByText('Отправить позже')).not.toBeInTheDocument();
});
