import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NetworkDashboard } from '../src/features/network';
import type { NetworkOverview } from '../src/lib/api';
import { pagesFor } from '../src/app/routes';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
});

const base = { groups: 3, students: 60, engagement: 0.5, lessons: 10, attendance: 0.9, earned: 100, lost: 12, teachers: 4 };
const OVERVIEW: NetworkOverview = {
  name: 'Управление образования',
  from: '2026-11-01',
  to: '2026-11-09',
  schools: [
    { ...base, key: 's1', name: 'Колледж связи', kind: 'COLLEGE', engagement: null, attendance: null },
    { ...base, key: 's2', name: 'Школа № 5', kind: 'SCHOOL' },
  ],
  total: { ...base, key: 'total', name: 'Всего', groups: 6, students: 120, teachers: 8, earned: 200, lost: 24 },
};

it('руководитель сети видит учреждения сети с итогом и меняет период', async () => {
  api.mockResolvedValue(OVERVIEW as never);
  renderApp(<NetworkDashboard />);
  expect(await screen.findByRole('heading', { name: 'Управление образования' })).toBeVisible();
  expect(screen.getByText('Учреждений', { selector: 'dt' }).nextSibling).toHaveTextContent('2');
  const rows = within(screen.getByRole('region', { name: 'Учреждения сети' })).getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Колледж связиКолледж или техникум3604——+100−12');
  expect(rows[3]).toHaveTextContent('Всего6120850%90%+200−24');
  fireEvent.change(screen.getByLabelText('С'), { target: { value: '2026-09-01' } });
  expect(api).toHaveBeenLastCalledWith('GET', expect.stringMatching(/^\/network\/overview\?from=2026-09-01&to=/));
  expect(screen.getByRole('link', { name: /Excel/ }).getAttribute('href')).toMatch(/^\/api\/network\/overview\.xlsx\?from=2026-09-01/);
});

it('главная руководителя сети загружает только его страницу', () => {
  expect(pagesFor('/', 'NETWORK')).toEqual(['network']);
});
