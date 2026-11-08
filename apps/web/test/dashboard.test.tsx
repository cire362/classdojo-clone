import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TermsProvider } from '../src/features/auth';
import { LeaderDashboard } from '../src/features/dashboard';
import type { Dashboard, DashboardRow } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
});

const row = (key: string, name: string, extra: Partial<DashboardRow> = {}): DashboardRow => ({
  key, name, groups: 1, students: 20, engagement: 0.75, lessons: 4, attendance: 0.9, earned: 40, lost: 5, ...extra,
});
const report = (by: Dashboard['by']): Dashboard => ({
  from: '2026-11-01', to: '2026-11-09', by,
  rows: by === 'department' ? [row('d1', 'Отделение ИТ', { groups: 2 })] : [row('g1', 'ИС-21'), row('g2', 'ИС-22', { attendance: null })],
  total: row('total', 'Всего', { groups: 2, students: 40, engagement: 0.6, attendance: 0.85, earned: 80, lost: 10 }),
});

it('панель руководителя колледжа: показатели, таблица по группам, разрез по отделениям и выгрузки', async () => {
  api.mockImplementation(async (_m, path) => report(new URLSearchParams(path.split('?')[1]).get('by') as Dashboard['by']) as never);
  renderApp(<TermsProvider kind="COLLEGE"><LeaderDashboard /></TermsProvider>);
  expect(await screen.findByRole('heading', { name: 'Обзор колледжа' })).toBeVisible();
  expect(screen.getByText('Вовлечённость', { selector: 'dt' }).nextSibling).toHaveTextContent('60%');
  expect(screen.getByText('Минусы', { selector: 'dt' }).nextSibling).toHaveTextContent('−10');
  const table = screen.getByRole('region', { name: 'Таблица обзора' });
  const rows = within(table).getAllByRole('row');
  expect(rows[2]).toHaveTextContent('ИС-2212075%4—+40−5');
  expect(rows[3]).toHaveTextContent('Всего24060%485%+80−10');
  expect(screen.getByRole('link', { name: /Excel/ }).getAttribute('href')).toMatch(/^\/api\/admin\/dashboard\.xlsx\?by=group&from=/);

  fireEvent.change(screen.getByLabelText('Разрез'), { target: { value: 'department' } });
  expect(await within(screen.getByRole('region', { name: 'Таблица обзора' })).findByText('Отделение ИТ')).toBeVisible();
  expect(api).toHaveBeenLastCalledWith('GET', expect.stringMatching(/^\/admin\/dashboard\?by=department&from=/));
  expect(screen.getByRole('link', { name: /PDF/ }).getAttribute('href')).toMatch(/dashboard\.pdf\?by=department/);
});

it('в школе разрез по параллелям, а подразделений нет', async () => {
  api.mockResolvedValue(report('group') as never);
  renderApp(<LeaderDashboard />);
  const select = await screen.findByLabelText('Разрез');
  expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Классы', 'Параллели']);
});
