import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TermsProvider } from '../src/features/auth';
import { AdminPanel } from '../src/features/accounts/components/AdminPanel';
import { SchoolGroups } from '../src/features/accounts/components/SchoolGroups';
import { Departments } from '../src/features/departments/components/Departments';
import type { AdminGroup, Department, SchoolInfo } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const DEPARTMENTS: Department[] = [
  { id: 'it', name: 'Факультет ИТ', parentId: null, groups: 2, admins: 1 },
  { id: 'pi', name: 'Кафедра ПИ', parentId: 'it', groups: 1, admins: 0 },
];
const GROUP: AdminGroup = {
  id: 'g1', name: 'ПИ-21', archivedAt: null, studentsCount: 20, filesExpireAt: null, department: { id: 'pi', name: 'Кафедра ПИ' },
  course: 2, specialty: 'Программная инженерия', owner: { id: 't1', name: 'Анна', login: 'anna' }, colleagues: [],
};

it('факультеты показываются деревом, новое подразделение создаётся внутри факультета', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? DEPARTMENTS : DEPARTMENTS) as never);
  renderApp(<TermsProvider kind="UNIVERSITY"><Departments canEdit /></TermsProvider>);
  const list = await screen.findByRole('list', { name: 'Факультеты' });
  const [faculty, chair] = within(list).getAllByRole('listitem');
  expect(faculty).toHaveTextContent('Факультет ИТ2 группы · 1 сотрудник');
  expect(chair).toHaveTextContent('Кафедра ПИ');
  fireEvent.click(screen.getByRole('button', { name: /Добавить/ }));
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: ' Кафедра ИС ' } });
  fireEvent.change(screen.getByLabelText('Входит в'), { target: { value: 'it' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/departments', { name: 'Кафедра ИС', parentId: 'it' });
});

it('у группы видно подразделение, курс и специальность; их можно изменить', async () => {
  api.mockImplementation(async (method, path) => {
    if (path === '/admin/departments') return DEPARTMENTS as never;
    return [method === 'GET' ? GROUP : { ...GROUP, course: 3 }] as never;
  });
  renderApp(<TermsProvider kind="UNIVERSITY"><SchoolGroups canExport departmentId={null} /></TermsProvider>);
  expect(await screen.findByText('Кафедра ПИ · курс 2 · Программная инженерия')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Подразделение и курс: ПИ-21' }));
  const dialog = await screen.findByRole('dialog', { name: 'Группа ПИ-21' });
  expect(within(dialog).getByLabelText('Подразделение')).toHaveDisplayValue('— Кафедра ПИ');
  fireEvent.change(within(dialog).getByLabelText('Курс'), { target: { value: '3' } });
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('PATCH', '/admin/groups/g1', { departmentId: 'pi', course: 3, specialty: 'Программная инженерия' });
  expect(await screen.findByText('Кафедра ПИ · курс 3 · Программная инженерия')).toBeVisible();
});

it('декан видит подпись своего подразделения и не управляет преподавателями учреждения', async () => {
  const school: SchoolInfo = {
    id: 's1', name: 'Политех', kind: 'UNIVERSITY', heroes: false, role: 'DEPUTY', joinCode: null, pendingTeachers: 0,
    department: { id: 'it', name: 'Факультет ИТ' },
  };
  api.mockImplementation(async (_m, path) => {
    if (path === '/admin/school') return school as never;
    if (path === '/admin/teachers') return { freeForAll: true, teachers: [] } as never;
    return [] as never;
  });
  renderApp(<AdminPanel />);
  expect(await screen.findByText('Декан: Факультет ИТ')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Добавить преподавателя/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Подключение преподавателей')).not.toBeInTheDocument();
});
