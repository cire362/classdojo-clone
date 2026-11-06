import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SchoolTitle } from '../src/features/accounts/components/SchoolTitle';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

it('название школы видно заголовком и меняется; пустое сохранить нельзя', async () => {
  api.mockImplementation(async (method, _path, body) =>
    (method === 'GET' ? { id: 's1', name: 'Моя школа' } : { id: 's1', name: (body as { name: string }).name }) as never);
  renderApp(<SchoolTitle />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Моя школа' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Переименовать школу' }));
  const field = screen.getByLabelText('Название школы');
  expect(field).toHaveValue('Моя школа');
  fireEvent.change(field, { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  fireEvent.change(field, { target: { value: ' Гимназия № 5 ' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('PATCH', '/admin/school', { name: 'Гимназия № 5' });
  expect(screen.getByRole('heading', { level: 1, name: 'Гимназия № 5' })).toBeVisible();
});
