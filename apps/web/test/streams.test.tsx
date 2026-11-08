import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_HERO } from '@heroes/shared';
import { TermsProvider } from '../src/features/auth';
import { StreamBoard, StreamsSection } from '../src/features/streams';
import type { GroupListItem, StreamBoard as Board, StreamItem } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
});

const group = (id: string, name: string): GroupListItem =>
  ({
    id, name, subtractTeacher: false, studentsCount: 1, archivedAt: null, previewHeroes: [], isOwner: true, colleagues: [],
  }) as GroupListItem;
const STREAM: StreamItem = {
  id: 'st1', name: 'Лекция по истории', subject: { id: 'hist', name: 'История' },
  groups: [{ id: 'g1', name: 'ИС-21' }, { id: 'g2', name: 'ИС-22' }],
};
const student = (id: string, name: string) => ({
  id, name, hero: { name: '', parts: DEFAULT_HERO }, todayEarned: 0, totalEarned: 4, level: 1,
});
const BOARD: Board = {
  stream: STREAM,
  groups: [
    { id: 'g1', name: 'ИС-21', students: [student('s1', 'Маша Иванова')] },
    { id: 'g2', name: 'ИС-22', students: [student('s2', 'Петя Смирнов')] },
  ],
  reasons: [{ id: 'r1', name: 'Помог другу', emoji: '🤝', value: 1 }],
};

it('в школе потоков нет: раздел не показывается и не загружается', () => {
  renderApp(<TermsProvider kind="SCHOOL"><StreamsSection /></TermsProvider>);
  expect(screen.queryByRole('heading', { name: 'Потоки' })).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

it('преподаватель колледжа создаёт поток из двух групп с дисциплиной', async () => {
  api.mockImplementation(async (method, path) => {
    if (path === '/teacher/groups') return [group('g1', 'ИС-21'), group('g2', 'ИС-22'), group('g3', 'ИС-23')] as never;
    if (path === '/teacher/subjects') return [{ id: 'hist', name: 'История', groups: 2 }] as never;
    return (method === 'GET' ? [] : [STREAM]) as never;
  });
  renderApp(<TermsProvider kind="COLLEGE"><StreamsSection /></TermsProvider>);
  fireEvent.click(await screen.findByRole('button', { name: /Новый поток/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Новый поток' });
  fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: ' Лекция по истории ' } });
  fireEvent.click(await within(dialog).findByLabelText('ИС-21'));
  expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  fireEvent.click(within(dialog).getByLabelText('ИС-22'));
  fireEvent.change(await within(dialog).findByLabelText('Дисциплина'), { target: { value: 'hist' } });
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('POST', '/teacher/streams', { name: 'Лекция по истории', groupIds: ['g1', 'g2'], subjectId: 'hist' });
  const link = await screen.findByRole('link', { name: /Лекция по истории/ });
  expect(link).toHaveAttribute('href', '/streams/st1');
  expect(link).toHaveTextContent('История · ИС-21, ИС-22');
});

it('занятие потока: баллы всему потоку и отметка посещаемости по всем группам', async () => {
  api.mockImplementation(async (method, path, body) => {
    if (path === '/teacher/streams/st1') return BOARD as never;
    if (path === '/teacher/streams/st1/points') {
      const { studentIds } = body as { studentIds: string[] };
      const summaries = Object.fromEntries(studentIds.map((id) => [id, { todayEarned: 1, totalEarned: 5, level: 1 }]));
      return { value: 1, summaries } as never;
    }
    if (path.startsWith('/teacher/streams/st1/attendance') && method === 'GET') {
      return { date: '2026-11-09', lesson: 1, marked: 0, presentStudentIds: [] } as never;
    }
    return { presentCount: 1, studentsTotal: 2 } as never;
  });
  renderApp(<StreamBoard streamId="st1" />);
  expect(await screen.findByRole('heading', { name: 'Лекция по истории' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Всему потоку/ }));
  const picker = await screen.findByRole('dialog', { name: 'Весь поток' });
  await act(async () => fireEvent.click(within(picker).getByRole('button', { name: /Помог другу/ })));
  expect(api).toHaveBeenCalledWith('POST', '/teacher/streams/st1/points', { studentIds: ['s1', 's2'], reasonId: 'r1' });
  expect(await screen.findByText('Весь поток: +1, помог другу')).toBeInTheDocument();
  expect(screen.getAllByText('всего 5')).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: 'Посещаемость' }));
  expect(await screen.findByText('Занятие ещё не отмечено')).toBeVisible();
  fireEvent.click(screen.getByLabelText('Петя Смирнов'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить отметку' })));
  const marked = expect.objectContaining({ lesson: 1, presentStudentIds: ['s2'] });
  expect(api).toHaveBeenCalledWith('POST', '/teacher/streams/st1/attendance', marked);
  expect(await screen.findByText('Отмечено: 1 из 2')).toBeInTheDocument();
});
