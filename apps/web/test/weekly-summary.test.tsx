import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { api, type WeeklySummary as Summary } from '../src/lib/api';
import { WeeklySummary } from '../src/components/WeeklySummary';
import { renderApp } from './render';

vi.mock('../src/lib/api', () => ({ api: vi.fn() }));
const child = { id: 's1', name: 'Маша Иванова', groupName: '5 «А»' };
const report = (patch: Partial<Summary> = {}): Summary => ({
  studentId: 's1', from: '2026-10-26', to: '2026-11-01', currentFrom: '2026-10-26', previousWeek: '2026-10-19', nextWeek: null, isCurrent: true,
  points: { earned: 5, lost: 2, net: 3, events: 3 },
  reasons: [{ name: 'Помощь', emoji: '⭐', earned: 5, lost: 2, count: 3 }],
  attendance: { total: 2, attended: 1, missed: 1, records: [{ id: 'a1', date: '2026-10-26', lesson: 1, groupName: '5 «А»', present: true }, { id: 'a2', date: '2026-10-26', lesson: 2, groupName: '5 «А»', present: false }] }, ...patch,
});

it('показывает итог, обе стороны одной причины и отдельные уроки без выдуманных пропусков', async () => {
  vi.mocked(api).mockResolvedValue(report());
  renderApp(<WeeklySummary child={child} />);
  await screen.findByText('Помощь');
  expect(screen.getAllByText('+5')).toHaveLength(2);
  expect(screen.getAllByText('−2')).toHaveLength(2);
  expect(screen.getByText('+3')).toBeVisible();
  expect(screen.getByText('Пропуск')).toBeVisible();
  expect(screen.getByText(/2-й урок/)).toBeVisible();
  expect(screen.getByText('Уроки без отметки не считаются пропусками.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Следующая неделя' })).toBeDisabled();
});

it('переключает недели, нормализует дату с сервера и возвращает текущую неделю', async () => {
  vi.mocked(api).mockImplementation(async (_method, path) => path.includes('?') ? report({ from: '2026-10-19', to: '2026-10-25', previousWeek: '2026-10-12', nextWeek: '2026-10-26', isCurrent: false }) : report());
  const { user } = renderApp(<WeeklySummary child={child} />);
  await screen.findByText('Помощь');
  await user.click(screen.getByRole('button', { name: 'Предыдущая неделя' }));
  await waitFor(() => expect(screen.getByLabelText('Неделя с')).toHaveValue('2026-10-19'));
  expect(api).toHaveBeenCalledWith('GET', '/parent/children/s1/weekly-summary?week=2026-10-19');
  expect(screen.getByRole('button', { name: 'Следующая неделя' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Текущая неделя' }));
  await waitFor(() => expect(screen.getByLabelText('Неделя с')).toHaveValue('2026-10-26'));
});

it('при ошибке позволяет повторить загрузку, пустые данные объясняет словами', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('Нет связи')).mockResolvedValue(report({ points: { earned: 0, lost: 0, net: 0, events: 0 }, reasons: [], attendance: { total: 0, attended: 0, missed: 0, records: [] } }));
  const { user } = renderApp(<WeeklySummary child={child} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи');
  await user.click(screen.getByRole('button', { name: /Повторить/ }));
  expect(await screen.findByText('Отметок за эту неделю пока нет.')).toBeVisible();
  expect(screen.getByText('За эту неделю начислений и списаний пока нет.')).toBeVisible();
});

it('поздний ответ предыдущей недели не заменяет выбранную дату и её итог', async () => {
  let resolveOld!: (v: Summary) => void;
  vi.mocked(api).mockImplementation(async (_method, path) => path.includes('2026-10-19') ? new Promise<Summary>((resolve) => { resolveOld = resolve; }) : report({ reasons: [{ name: 'Новая неделя', emoji: '⭐', earned: 5, lost: 0, count: 1 }] }));
  renderApp(<WeeklySummary child={child} />);
  await screen.findByText('Новая неделя');
  fireEvent.change(screen.getByLabelText('Неделя с'), { target: { value: '2026-10-19' } });
  await waitFor(() => expect(resolveOld).toBeDefined());
  fireEvent.change(screen.getByLabelText('Неделя с'), { target: { value: '2026-10-26' } });
  await screen.findByText('Новая неделя');
  await act(async () => resolveOld(report({ from: '2026-10-19', reasons: [{ name: 'Устаревший ответ', emoji: '⭐', earned: 1, lost: 0, count: 1 }] })));
  expect(screen.queryByText('Устаревший ответ')).not.toBeInTheDocument();
  expect(screen.getByText('Новая неделя')).toBeVisible();
});

it('смена ребёнка не показывает ответ предыдущего ребёнка', async () => {
  let resolveOld!: (v: Summary) => void;
  vi.mocked(api).mockImplementation(async (_method, path) => path.includes('/s1/') ? new Promise<Summary>((resolve) => { resolveOld = resolve; }) : report({ studentId: 's2', reasons: [{ name: 'Работа Вани', emoji: '⭐', earned: 1, lost: 0, count: 1 }] }));
  const view = renderApp(<WeeklySummary key="s1" child={child} />);
  await waitFor(() => expect(resolveOld).toBeDefined());
  view.rerender(<WeeklySummary key="s2" child={{ ...child, id: 's2', name: 'Ваня Иванов' }} />);
  await screen.findByText('Работа Вани');
  await act(async () => resolveOld(report()));
  expect(screen.queryByText('Помощь')).not.toBeInTheDocument();
  expect(screen.getByText('Работа Вани')).toBeVisible();
});
