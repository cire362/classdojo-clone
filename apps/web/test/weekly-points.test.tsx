import { act, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { api, type WeeklyStats } from '../src/lib/api';
import { WeeklyPoints, weeklyScale } from '../src/features/stats/components/WeeklyPoints';
import { groupData } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', () => ({ api: vi.fn() }));
const group = groupData();
group.teams = [{ id: 't1', name: 'Кометы', color: '#123456' }];
const report = (patch: Partial<WeeklyStats> = {}): WeeklyStats => ({
  groupId: 'g1', from: '2025-12-31', to: '2026-01-11', scope: { kind: 'group', id: 'g1', name: '5 «А»' }, members: 2,
  points: { earned: 4, lost: 3, net: 1, events: 3 }, weeks: [
    { week: '2025-12-29', from: '2025-12-31', to: '2026-01-04', partial: true, earned: 4, lost: 0, net: 4, events: 2 },
    { week: '2026-01-05', from: '2026-01-05', to: '2026-01-11', partial: false, earned: 0, lost: 3, net: -3, events: 1 },
  ], ...patch,
});
const renderChart = () => renderApp(<WeeklyPoints group={group} from="2025-12-31" to="2026-01-11" />);

it('нулевая и отрицательная шкалы конечны, содержат ноль и целые деления', () => {
  for (const values of [[0, 0], [-3, -10], [-3, 4], [10000]]) {
    const scale = weeklyScale(values);
    expect(scale.ticks).toContain(0);
    expect(scale.ticks.every(Number.isInteger)).toBe(true);
    for (const n of values) { expect(scale.y(n)).toBeGreaterThanOrEqual(0); expect(scale.y(n)).toBeLessThanOrEqual(100); }
  }
});

it('клавиатура выбирает неделю и её расшифровку; минусы направлены ниже нуля', async () => {
  vi.mocked(api).mockResolvedValue(report());
  const { user } = renderChart();
  const graph = await screen.findByRole('group', { name: 'Недели на графике' });
  expect(within(graph).getByRole('button', { name: /^29\.12\*/ })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Итого' }));
  const last = within(graph).getByRole('button', { name: /: −3$/ });
  last.focus();
  await user.keyboard('{ArrowLeft}');
  expect(within(graph).getByRole('button', { name: /неполная неделя/ })).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('неполная неделя');
  await user.keyboard('{End}');
  expect(last).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('итого −3');
  await user.click(screen.getByText('Данные графика таблицей'));
  expect(screen.getByRole('table')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Минусы' }));
  expect(within(graph).getByRole('button', { name: /: −3$/ })).toBeVisible();
});

it('запрашивает выбранного ученика и команду в том же периоде', async () => {
  vi.mocked(api).mockResolvedValue(report());
  const { user } = renderChart();
  await screen.findByRole('status');
  await user.selectOptions(screen.getByLabelText('Кого показать'), 'student:s1');
  await waitFor(() => expect(api).toHaveBeenCalledWith('GET', '/teacher/groups/g1/stats/weekly?from=2025-12-31&to=2026-01-11&studentId=s1'));
  await user.selectOptions(screen.getByLabelText('Кого показать'), 'team:t1');
  await waitFor(() => expect(api).toHaveBeenCalledWith('GET', '/teacher/groups/g1/stats/weekly?from=2025-12-31&to=2026-01-11&teamId=t1'));
});

it('ошибку можно повторить, нулевые данные объясняются без пустого графика', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('Нет связи')).mockResolvedValue(report({ points: { earned: 0, lost: 0, net: 0, events: 0 }, weeks: [{ ...report().weeks[0], earned: 0, lost: 0, net: 0, events: 0 }] }));
  const { user } = renderChart();
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи');
  await user.click(screen.getByRole('button', { name: /Повторить/ }));
  expect(await screen.findByText(/На графике — нулевые недели/)).toBeVisible();
  expect(screen.getByRole('group', { name: 'Недели на графике' })).toBeVisible();
});

it('запоздалый ответ прежнего периода не возвращается на экран', async () => {
  let resolveOld!: (v: WeeklyStats) => void;
  vi.mocked(api).mockImplementation(async (_method, path) => path.includes('2025-12-31') ? new Promise<WeeklyStats>((resolve) => { resolveOld = resolve; }) : report({ from: '2026-01-05', scope: { kind: 'group', id: 'g1', name: 'Свежая сводка' } }));
  const view = renderChart();
  await waitFor(() => expect(resolveOld).toBeDefined());
  view.rerender(<WeeklyPoints group={group} from="2026-01-05" to="2026-01-11" />);
  await screen.findByText(/Свежая сводка ·/);
  await act(async () => resolveOld(report()));
  expect(screen.queryByText(/5 «А» ·/)).not.toBeInTheDocument();
});
