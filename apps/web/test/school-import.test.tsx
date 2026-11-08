import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TermsProvider } from '../src/features/auth';
import { ImportSchoolModal } from '../src/features/schoolimport';
import type { ImportPlan } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
});

const PLAN: ImportPlan = {
  departments: ['Отделение ИТ'],
  teachers: [{ name: 'Игорь Павлович', login: 'igor.p' }],
  groups: [
    {
      name: 'ИС-21', exists: false, department: 'Отделение ИТ', course: 2, specialty: '',
      teacher: { name: 'Игорь Павлович', login: 'igor.p', exists: false }, students: 0, newStudents: ['Лиза Ершова', 'Глеб Орлов'],
    },
  ],
  errors: [],
};

it('колледж: файл проверяется, план показывает новое, после импорта видны входы преподавателей', async () => {
  api.mockImplementation(async (_m, path) =>
    (path === '/admin/school-import/preview'
      ? PLAN
      : { groups: 1, students: 2, teachers: [{ id: 't1', name: 'Игорь Павлович', login: 'igor.p', password: 'kite-river-42' }] }) as never);
  const onDone = vi.fn();
  renderApp(<TermsProvider kind="COLLEGE"><ImportSchoolModal onClose={() => {}} onDone={onDone} /></TermsProvider>);
  const file = new File(['Группа;ФИО'], 'college.csv');
  fireEvent.change(screen.getByLabelText('Файл Excel или CSV'), { target: { files: [file] } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Проверить файл' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/school-import/preview', expect.any(FormData));
  const summary = screen.getByRole('region', { name: 'Что будет создано' });
  const text = '1 группа, новых студентов: 2, новые подразделения: Отделение ИТ, новые преподаватели: Игорь Павлович.';
  expect(summary).toHaveTextContent(text);
  expect(within(summary).getByRole('list', { name: 'Группы из файла' })).toHaveTextContent('ИС-21 (новая)Игорь Павлович · курс 2 · +2');

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Импортировать' })));
  expect(screen.getByRole('status')).toHaveTextContent('Создано групп: 1, добавлено студентов: 2, новых преподавателей: 1.');
  expect(screen.getByRole('list', { name: 'Входы преподавателей' })).toHaveTextContent('kite-river-42');
  fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
  expect(onDone).toHaveBeenCalled();
});

it('ошибки в файле показываются построчно, и импорт недоступен', async () => {
  const errors = [{ line: 3, message: 'Не указана группа' }, { line: 0, message: 'У новой группы «X» не указан преподаватель' }];
  api.mockResolvedValue({ ...PLAN, errors } as never);
  renderApp(<ImportSchoolModal onClose={() => {}} onDone={() => {}} />);
  fireEvent.change(screen.getByLabelText('Файл Excel или CSV'), { target: { files: [new File(['x'], 'x.csv')] } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Проверить файл' })));
  const list = screen.getByRole('list', { name: 'Ошибки в файле' });
  expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Строка 3: Не указана группа',
    'У новой группы «X» не указан преподаватель',
  ]);
  expect(screen.getByRole('button', { name: 'Импортировать' })).toBeDisabled();
});
