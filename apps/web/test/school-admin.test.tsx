import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { pagesFor } from '../src/app/routes';
import { AdminPanel } from '../src/features/accounts/components/AdminPanel';
import { TeacherJoin } from '../src/features/accounts/components/TeacherJoin';
import type { SchoolInfo, StaffMember, TeacherRequest } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const SCHOOL: SchoolInfo = {
  id: 's1', name: 'Моя школа', kind: 'SCHOOL', heroes: true, role: 'DIRECTOR', joinCode: 'ABCD2345', pendingTeachers: 1, department: null,
};
const REQUEST: TeacherRequest = { id: 't9', name: 'Анна Петровна', login: 'anna', createdAt: '2026-11-07T08:00:00.000Z' };
const STAFF: StaffMember[] = [
  { id: 'a1', name: 'Ирина Львовна', login: 'director', role: 'DIRECTOR', departmentId: null, isMe: true },
  { id: 'a2', name: 'Олег Ильич', login: 'oleg', role: 'DEPUTY', departmentId: null, isMe: false },
];
const GROUP = {
  id: 'g1', name: '3 «А»', archivedAt: null, studentsCount: 2, filesExpireAt: null, colleagues: [],
  owner: { id: 't1', name: 'Маша', login: 'masha' },
};

function backend(school: SchoolInfo, overrides: Record<string, unknown> = {}) {
  api.mockImplementation(async (method, path, body) => {
    const key = `${method} ${path}`;
    if (key in overrides) return overrides[key] as never;
    if (key === 'GET /admin/school') return school as never;
    if (key === 'PATCH /admin/school') return { ...school, ...(body as object) } as never;
    if (key === 'GET /admin/teacher-requests') return [REQUEST] as never;
    if (key === 'GET /admin/teachers') return { freeForAll: true, teachers: [] } as never;
    if (key === 'GET /admin/groups') return [GROUP] as never;
    if (key === 'GET /admin/staff') return STAFF as never;
    if (key === 'GET /admin/departments') return [] as never;
    throw new Error(`unexpected ${key}`);
  });
}

it('адрес подключения к школе', () => {
  expect(pagesFor('/school-join')).toEqual(['schoolJoin']);
});

it('директор: название меняется, код школы виден, заявка подтверждается и пропадает из счётчика', async () => {
  backend(SCHOOL, { 'POST /admin/teacher-requests/t9/approve': [] });
  renderApp(<AdminPanel />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Моя школа' })).toBeVisible();
  expect(screen.getByText('Директор')).toBeVisible();
  expect(screen.getByRole('button', { name: /Преподаватели.*1 ждут проверки/ })).toBeVisible();
  expect(screen.getByText('ABCD-2345')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Изменить название и тип' }));
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: ' Гимназия № 5 ' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('PATCH', '/admin/school', { name: 'Гимназия № 5', kind: 'SCHOOL' });
  expect(screen.getByRole('heading', { level: 1, name: 'Гимназия № 5' })).toBeVisible();

  const requests = await screen.findByRole('list', { name: 'Заявки преподавателей' });
  await act(async () => fireEvent.click(within(requests).getByRole('button', { name: 'Подтвердить: Анна Петровна' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/teacher-requests/t9/approve');
  expect(await screen.findByText('Анна Петровна может войти')).toBeVisible();
  expect(screen.getByText('Новых заявок нет.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Преподаватели' })).toBeVisible();
});

it('сотрудник только смотрит: ни кнопок изменений, ни кода школы, ни выгрузки файлов', async () => {
  backend({ ...SCHOOL, role: 'STAFF', joinCode: null, pendingTeachers: 0 });
  renderApp(<AdminPanel />);
  expect(await screen.findByText('Сотрудник')).toBeVisible();
  expect(await screen.findByText('Преподавателей пока нет.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Изменить название и тип' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Добавить преподавателя/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Подключение преподавателей')).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalledWith('GET', '/admin/teacher-requests');

  fireEvent.click(screen.getByRole('button', { name: 'Классы школы' }));
  expect(await screen.findByText('3 «А»')).toBeVisible();
  expect(screen.queryByRole('link', { name: /Скачать файлы/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Администрация' }));
  expect(await screen.findByText('Олег Ильич')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Добавить сотрудника/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Должность: Олег Ильич')).not.toBeInTheDocument();
});

it('директор меняет должность сотрудника и удаляет его после подтверждения; себя изменить не может', async () => {
  const demoted: StaffMember[] = [STAFF[0], { ...STAFF[1], role: 'STAFF' }];
  backend(SCHOOL, { 'PUT /admin/staff/a2/role': demoted, 'DELETE /admin/staff/a2': [STAFF[0]] });
  renderApp(<AdminPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Администрация' }));
  const role = await screen.findByLabelText('Должность: Олег Ильич');
  expect(screen.queryByLabelText('Должность: Ирина Львовна')).not.toBeInTheDocument();
  await act(async () => fireEvent.change(role, { target: { value: 'STAFF' } }));
  expect(api).toHaveBeenCalledWith('PUT', '/admin/staff/a2/role', { role: 'STAFF' });
  expect(role).toHaveValue('STAFF');

  fireEvent.click(screen.getByRole('button', { name: 'Удалить: Олег Ильич' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Удалить вход' })));
  expect(api).toHaveBeenCalledWith('DELETE', '/admin/staff/a2');
  expect(screen.queryByText('Олег Ильич')).not.toBeInTheDocument();
});

it('преподаватель: код из ссылки проверяется сразу, заявка уходит с именем, логином и паролем', async () => {
  window.history.replaceState(null, '', '/school-join#ABCD2345');
  api.mockResolvedValue({ schoolName: 'Гимназия № 5', kind: 'SCHOOL' } as never);
  renderApp(<TeacherJoin />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Гимназия № 5' })).toBeVisible();
  expect(api).toHaveBeenCalledWith('POST', '/auth/school-join/preview', { code: 'ABCD2345' });
  expect(window.location.hash).toBe('');

  const send = screen.getByRole('button', { name: 'Отправить заявку' });
  fireEvent.change(screen.getByLabelText('Как вас называть ученикам'), { target: { value: ' Анна Петровна ' } });
  fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'Anna' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret-123' } });
  fireEvent.change(screen.getByLabelText('Пароль ещё раз'), { target: { value: 'secret-12' } });
  expect(screen.getByText('Пароли не совпадают.')).toBeVisible();
  expect(send).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Пароль ещё раз'), { target: { value: 'secret-123' } });
  await act(async () => fireEvent.click(send));
  const sent = { code: 'ABCD2345', name: 'Анна Петровна', login: 'Anna', password: 'secret-123' };
  expect(api).toHaveBeenCalledWith('POST', '/auth/school-join', sent);
  expect(screen.getByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
  expect(screen.getByText('anna')).toBeVisible();
});

it('преподаватель: неверный код показывает ошибку и не открывает форму', async () => {
  window.history.replaceState(null, '', '/school-join');
  api.mockRejectedValue(new Error('Код школы не подошёл'));
  renderApp(<TeacherJoin />);
  fireEvent.change(screen.getByLabelText('Код подключения'), { target: { value: 'zzzz-zzzz' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Дальше' })));
  expect(screen.getByRole('alert')).toHaveTextContent('Код школы не подошёл');
  expect(screen.queryByLabelText('Пароль')).not.toBeInTheDocument();
});

it('вуз: слова панели и должности по типу; руководитель переводит школу в колледж — слова меняются сразу', async () => {
  backend({ ...SCHOOL, name: 'Политех', kind: 'UNIVERSITY', pendingTeachers: 0 });
  renderApp(<AdminPanel />);
  expect(await screen.findByText('Ректор')).toBeVisible();
  for (const tab of ['Ящик вуза', 'Группы вуза', 'Баллы вуза', 'Лента вуза']) {
    expect(screen.getByRole('button', { name: tab })).toBeVisible();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Администрация' }));
  expect(await screen.findByText('Олег Ильич')).toBeVisible();
  expect(screen.getByLabelText('Должность: Олег Ильич')).toHaveDisplayValue('Проректор');

  fireEvent.click(screen.getByRole('button', { name: 'Изменить название и тип' }));
  fireEvent.change(screen.getByLabelText('Тип учреждения'), { target: { value: 'COLLEGE' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('PATCH', '/admin/school', { name: 'Политех', kind: 'COLLEGE' });
  expect(screen.getByText('Колледж или техникум')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Группы колледжа' })).toBeVisible();
  expect(screen.getByLabelText('Должность: Олег Ильич')).toHaveDisplayValue('Заместитель директора');
});
