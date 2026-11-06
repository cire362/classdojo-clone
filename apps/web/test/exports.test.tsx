import { screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GroupSettingsModal } from '../src/features/groups/components/GroupSettingsModal';
import { exportUrl, longDate } from '../src/lib/files';
import { groupData, renderInGroup } from './group-harness';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue({ owner: { id: 't1', name: 'Анна Сергеевна', login: 'anna' }, coTeachers: [] } as never);
});

it('адрес архива и дата удаления', () => {
  expect(exportUrl('/parent/children/s1')).toBe('/api/parent/children/s1/export');
  expect(longDate('2027-11-06T09:00:00.000Z')).toBe('6 ноября 2027 г.');
});

it('архив группы скачивает любой преподаватель группы; создатель видит срок хранения перед архивацией', async () => {
  renderInGroup(<GroupSettingsModal open onClose={() => {}} />, groupData({ filesKeptDays: 365 }));
  const link = await screen.findByRole('link', { name: 'Скачать архив' });
  expect(link).toHaveAttribute('href', '/api/teacher/groups/g1/export');
  expect(link).toHaveAttribute('download');
  expect(screen.getByText(/хранятся 365\s+дней, потом удаляются/)).toBeVisible();
});

it('соавтор тоже скачивает архив, но не архивирует группу', async () => {
  renderInGroup(<GroupSettingsModal open onClose={() => {}} />, groupData({ isOwner: false, filesKeptDays: 30 }));
  expect(await screen.findByRole('link', { name: 'Скачать архив' })).toBeVisible();
  expect(screen.queryByText(/хранятся/)).not.toBeInTheDocument();
});
