import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { pagesFor } from '../src/app/routes';
import { GroupWorks } from '../src/features/works/components/GroupWorks';
import { MyWorks } from '../src/features/works/components/MyWorks';
import type { GroupWork, StudentWork } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';
import { TermsProvider } from '../src/features/auth';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
vi.mock('../src/lib/photo', () => ({ prepareImage: vi.fn(async (file: File) => new Blob([`мал-${file.name}`], { type: 'image/jpeg' })) }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const WORK: StudentWork = {
  id: 'w1', title: 'Доклад о космосе', text: 'Мой доклад', status: 'PENDING', comment: '', createdAt: '2026-11-06T10:00:00.000Z',
  decidedAt: null, decidedBy: null, files: [], unseen: false,
  to: { teacherId: 't1', subject: null, teacher: 'Анна Сергеевна', curator: true },
};
const CURATOR = { teacherId: 't1', teacher: 'Анна Сергеевна', subjectId: null, subject: null, curator: true };
const NO_SUBJECTS = [CURATOR];
/** Ответы ученику: адресаты, список работ и результат изменения */
const student = (works: StudentWork[], after: StudentWork[], recipients: object = NO_SUBJECTS) =>
  api.mockImplementation(async (method, path) =>
    (path === '/student/works/recipients' ? recipients : method === 'GET' ? works : after) as never);
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

it('адреса страниц работ', () => {
  expect(pagesFor('/works')).toEqual(['studentWorks']);
  expect(pagesFor('/g/abc/works')).toEqual(['groupLayout', 'groupWorks']);
});

it('ученик сдаёт работу: без названия и содержимого отправить нельзя, фото уходит уменьшенным', async () => {
  student([], [WORK]);
  renderApp(<MyWorks />);
  expect(await screen.findByText('Работ пока нет')).toBeVisible();
  expect(await screen.findByText('Классный руководитель — Анна Сергеевна')).toBeVisible();
  expect(screen.queryByLabelText('Кому')).not.toBeInTheDocument();
  const send = screen.getByRole('button', { name: 'Отправить' });
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: ' Доклад о космосе ' } });
  expect(send).toBeDisabled();
  const photo = new File(['x'], 'ракета.heic', { type: 'image/heic' });
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [photo] } });
  expect(send).toBeEnabled();
  await act(async () => fireEvent.click(send));
  const [, path, body] = api.mock.calls.find(([method]) => method === 'POST')!;
  expect(path).toBe('/student/works');
  const data = body as FormData;
  expect([data.get('title'), data.get('text'), (data.get('file') as File).name]).toEqual(['Доклад о космосе', '', 'ракета.jpg']);
  expect(data.get('subjectId')).toBeNull();
  expect(await screen.findByText('Работа отправлена: Классный руководитель — Анна Сергеевна')).toBeVisible();
  expect(screen.getByLabelText('Название')).toHaveValue('');
  expect(screen.getByRole('list', { name: 'Мои работы' })).toHaveTextContent('На проверке');
  expect(screen.getByRole('list', { name: 'Мои работы' })).toHaveTextContent('Кому: Классный руководитель — Анна Сергеевна');
});

it('студент выбирает, кому отправить: куратору, преподавателю дисциплины или коллеге без дисциплины', async () => {
  const recipients = [
    CURATOR,
    { teacherId: 't2', teacher: 'Пётр Ильич', subjectId: 'math', subject: 'Математика', curator: false },
    { teacherId: 't3', teacher: 'Игорь Павлович', subjectId: null, subject: null, curator: false },
  ];
  const sent = { teacherId: 't2', subject: 'Математика', teacher: 'Пётр Ильич', curator: false };
  student([], [{ ...WORK, to: sent }], recipients);
  renderApp(<TermsProvider kind="COLLEGE"><MyWorks /></TermsProvider>);
  const to = await screen.findByLabelText('Кому');
  expect(to).toHaveValue('t1:');
  expect(within(to).getByRole('option', { name: 'Куратор группы — Анна Сергеевна' })).toBeInTheDocument();
  expect(within(to).getByRole('option', { name: 'Игорь Павлович' })).toBeInTheDocument();
  fireEvent.change(to, { target: { value: 't2:math' } });
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Контрольная' } });
  fireEvent.change(screen.getByLabelText('Текст, если нужен'), { target: { value: 'Решение' } });
  await act(async () => click('Отправить'));
  const [, , body] = api.mock.calls.find(([method]) => method === 'POST')!;
  expect([(body as FormData).get('teacherId'), (body as FormData).get('subjectId')]).toEqual(['t2', 'math']);
  expect(await screen.findByText('Работа отправлена: Математика — Пётр Ильич')).toBeVisible();
});

it('решения преподавателя видны ученику; убрать можно только неопубликованную работу', async () => {
  const returned = { ...WORK, status: 'RETURNED' as const, comment: 'Допиши вывод', decidedBy: 'Анна Сергеевна', unseen: true };
  const approved = { ...WORK, id: 'w2', title: 'Рисунок', status: 'APPROVED' as const };
  student([returned, approved], [approved]);
  renderApp(<MyWorks />);
  const list = await screen.findByRole('list', { name: 'Мои работы' });
  expect(within(list).getByText('Вернули на доработку')).toBeVisible();
  expect(within(list).getByText('Допиши вывод')).toBeVisible();
  expect(within(list).getByText('Опубликована')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Убрать работу «Рисунок»' })).not.toBeInTheDocument();
  await act(async () => click('Убрать работу «Доклад о космосе»'));
  expect(api).toHaveBeenCalledWith('DELETE', '/student/works/w1');
  expect(screen.queryByText('Допиши вывод')).not.toBeInTheDocument();
});

const pending: GroupWork = { ...WORK, student: { id: 's1', name: 'Маша Иванова' }, mine: true };
const decided: GroupWork = { ...WORK, id: 'w2', title: 'Рисунок', status: 'APPROVED', comment: 'Молодец', decidedBy: 'Анна Сергеевна',
  student: { id: 's2', name: 'Петя Смирнов' }, mine: true };

it('преподаватель публикует работу с комментарием; очередь пустеет', async () => {
  api.mockImplementation(async (method) =>
    (method === 'GET' ? { pending: [pending], decided: [] } : { pending: [], decided: [{ ...pending, status: 'APPROVED' }] }) as never);
  renderInGroup(<GroupWorks />, groupData());
  expect(await screen.findByRole('heading', { name: 'На проверке: 1' })).toBeVisible();
  expect(screen.getByText('Маша Иванова')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Комментарий ученику'), { target: { value: ' Интересно! ' } });
  await act(async () => click('Опубликовать'));
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/works/w1', { status: 'APPROVED', comment: 'Интересно!' });
  expect(await screen.findByText('Работа опубликована: её видят родители')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'На проверке: 0' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Проверенные' })).toBeVisible();
});

it('проверенную работу можно снять с публикации и удалить после подтверждения', async () => {
  api.mockImplementation(async (method) => ({ pending: [], decided: method === 'DELETE' ? [] : [decided] }) as never);
  renderInGroup(<GroupWorks />, groupData());
  const unpublish = await screen.findByRole('button', { name: 'Снять с публикации' });
  await act(async () => fireEvent.click(unpublish));
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/works/w2', { status: 'RETURNED', comment: 'Молодец' });
  click('Удалить');
  await act(async () => click('Точно удалить'));
  expect(api).toHaveBeenCalledWith('DELETE', '/teacher/works/w2');
  expect(screen.queryByText('Рисунок')).not.toBeInTheDocument();
});

it('работы коллег — отдельно от своих: счётчик и «На проверке» только про свои', async () => {
  const colleague = { teacherId: 't2', subject: 'Математика', teacher: 'Пётр Ильич', curator: false };
  const theirs: GroupWork = { ...pending, id: 'w3', title: 'Задачи', mine: false, to: colleague };
  api.mockImplementation(async () => ({ pending: [pending, theirs], decided: [] }) as never);
  renderInGroup(<GroupWorks />, groupData());
  expect(await screen.findByRole('heading', { name: 'На проверке: 1' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'У других преподавателей: 1' })).toBeVisible();
  expect(screen.getByText(/Кому: Математика — Пётр Ильич/)).toBeVisible();
});
