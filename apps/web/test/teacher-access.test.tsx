import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SchoolTeachers } from '../src/features/accounts/components/SchoolTeachers';
import type { AdminTeacher, AdminTeachers } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
});

const teacher = (id: string, name: string, extra: Partial<AdminTeacher> = {}): AdminTeacher => ({
  id, name, login: id, ownedGroups: 0, sharedGroups: 0, disabled: false, ...extra,
});

it('директор отключает вход, передаёт группы коллеге и только потом может удалить преподавателя', async () => {
  let list: AdminTeachers = {
    teachers: [
      teacher('anna', 'Анна Сергеевна', { ownedGroups: 2 }), teacher('igor', 'Игорь Павлович'), teacher('olga', 'Ольга', { disabled: true }),
    ],
  };
  api.mockImplementation(async (method, path) => {
    if (method === 'PUT') list = { ...list, teachers: list.teachers.map((t) => (t.id === 'anna' ? { ...t, disabled: true } : t)) };
    if (method === 'POST') list = { ...list, teachers: list.teachers.map((t) => (t.id === 'anna' ? { ...t, ownedGroups: 0 } : t)) };
    if (method === 'DELETE') list = { ...list, teachers: list.teachers.filter((t) => t.id !== 'anna') };
    return (path === '/admin/teachers' || method !== 'GET' ? list : null) as never;
  });
  renderApp(<SchoolTeachers canManage />);
  expect(await screen.findByText('Вход отключён')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Доступ и группы: Анна Сергеевна' }));
  const dialog = await screen.findByRole('dialog', { name: 'Доступ: Анна Сергеевна' });
  expect(within(dialog).getByText('Удалить можно после передачи своих групп.')).toBeVisible();

  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Отключить вход' })));
  expect(api).toHaveBeenCalledWith('PUT', '/admin/teachers/anna/disabled', { disabled: true });
  expect(await within(dialog).findByRole('button', { name: 'Включить вход' })).toBeVisible();

  // Отключённую коллегу выбрать нельзя
  const select = within(dialog).getByLabelText('Кому передать');
  expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Выберите преподавателя', 'Игорь Павлович']);
  fireEvent.change(select, { target: { value: 'igor' } });
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Передать группы' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/teachers/anna/transfer', { toTeacherId: 'igor' });

  const remove = await within(dialog).findByRole('button', { name: 'Удалить преподавателя' });
  expect(remove).toBeDisabled();
  fireEvent.click(within(dialog).getByLabelText('Удалить безвозвратно'));
  await act(async () => fireEvent.click(remove));
  expect(api).toHaveBeenCalledWith('DELETE', '/admin/teachers/anna');
  expect(await screen.findByText('Преподаватель удалён')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
