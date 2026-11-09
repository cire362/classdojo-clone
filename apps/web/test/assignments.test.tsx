import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { pagesFor } from '../src/app/routes';
import { AssignmentForm } from '../src/features/assignments/components/AssignmentForm';
import { AssignmentReview } from '../src/features/assignments/components/AssignmentReview';
import { GroupAssignments } from '../src/features/assignments/components/GroupAssignments';
import { StudentAssignments } from '../src/features/assignments/components/StudentAssignments';
import type { AssignmentDetail, StudentAssignment, StudentWork, TeacherAssignment } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const TASK: TeacherAssignment = {
  id: 'a1', title: 'Решить задачи 1–5', description: 'Учебник, с. 42', dueOn: '2026-11-12', points: 3, createdAt: '2026-11-07T08:00:00.000Z',
  author: 'Анна Сергеевна', files: [], assigned: 2, pending: 1, accepted: 0, returned: 0,
};
const WORK: StudentWork = {
  id: 'w1', title: TASK.title, text: 'Ответы: 12, 7, 3', status: 'PENDING', comment: '', createdAt: '2026-11-13T10:00:00.000Z',
  decidedAt: null, decidedBy: null, files: [], unseen: false, to: null,
};

it('адреса страниц заданий', () => {
  expect(pagesFor('/assignments')).toEqual(['studentAssignments']);
  expect(pagesFor('/g/abc/assignments')).toEqual(['groupLayout', 'groupAssignments']);
  expect(pagesFor('/g/abc/assignments/a1')).toEqual(['groupLayout', 'groupAssignments']);
});

it('задание выбранным ученикам: без названия и учеников выдать нельзя; уходит формой со сроком и баллами', async () => {
  api.mockResolvedValue([TASK] as never);
  const created = vi.fn();
  renderInGroup(<AssignmentForm onCreated={created} />, groupData());
  const give = screen.getByRole('button', { name: 'Выдать задание' });
  fireEvent.change(screen.getByLabelText('Что сделать'), { target: { value: ' Решить задачи 1–5 ' } });
  fireEvent.click(screen.getByLabelText('Выбранным ученикам'));
  expect(give).toBeDisabled();
  fireEvent.click(within(screen.getByRole('list', { name: 'Ученики' })).getByLabelText('Петя Смирнов'));
  fireEvent.change(screen.getByLabelText('Сдать до'), { target: { value: '2026-11-12' } });
  fireEvent.change(screen.getByLabelText('Баллы за выполнение'), { target: { value: '3' } });
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['%PDF'], 'задачи.pdf', { type: 'application/pdf' })] } });
  await act(async () => fireEvent.click(give));
  const [method, path, body] = api.mock.calls[0];
  expect([method, path]).toEqual(['POST', '/teacher/groups/g1/assignments']);
  const data = body as FormData;
  expect(Object.fromEntries(['title', 'dueOn', 'points', 'target', 'studentId'].map((k) => [k, data.get(k)]))).toEqual({
    title: 'Решить задачи 1–5', dueOn: '2026-11-12', points: '3', target: 'students', studentId: 's2',
  });
  expect((data.get('file') as File).name).toBe('задачи.pdf');
  expect(created).toHaveBeenCalledWith([TASK]);
  expect(await screen.findByText('Задание выдано')).toBeVisible();
});

it('список заданий показывает срок, баллы и сколько ждёт проверки', async () => {
  api.mockResolvedValue([TASK] as never);
  renderInGroup(<GroupAssignments />, groupData(), 'assignments');
  const card = await screen.findByRole('link', { name: /Решить задачи 1–5/ });
  expect(card).toHaveAttribute('href', '/g/g1/assignments/a1');
  expect(card).toHaveTextContent('На проверке: 1');
  expect(card).toHaveTextContent('3 балла за выполнение');
  expect(card).toHaveTextContent('Сдали 1 из 2');
});

const DETAIL: AssignmentDetail = {
  ...TASK,
  answers: [
    { student: { id: 's1', name: 'Маша Иванова' }, status: 'PENDING', work: WORK, late: true },
    { student: { id: 's2', name: 'Петя Смирнов' }, status: 'NONE', work: null, late: false },
  ],
};

it('преподаватель принимает ответ с комментарием; несдавшие видны в списке; задание удаляется после подтверждения', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? DETAIL : method === 'DELETE' ? [] : { ...DETAIL, pending: 0 }) as never);
  renderInGroup(<AssignmentReview assignmentId="a1" />, groupData(), 'assignments/a1');
  expect(await screen.findByText('С опозданием')).toBeVisible();
  expect(screen.getByText('Ответа нет')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Комментарий ученику'), { target: { value: ' Верно! ' } });
  await act(async () => click('Принять'));
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/assignments/a1/answers/w1', { status: 'APPROVED', comment: 'Верно!' });
  expect(await screen.findByText('Ответ принят: Маша Иванова')).toBeVisible();

  click('Удалить задание');
  await act(async () => click('Точно удалить задание и ответы'));
  expect(api).toHaveBeenCalledWith('DELETE', '/teacher/groups/g1/assignments/a1');
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/g\/g1\/assignments$/);
});

const MINE: StudentAssignment[] = [
  { ...TASK, id: 'a2', title: 'Нарисовать осень', status: 'NONE', isNew: true, overdue: false, works: [] },
  { ...TASK, status: 'APPROVED', isNew: false, overdue: false, works: [{ ...WORK, status: 'APPROVED', comment: 'Молодец' }] },
];

it('ученик видит новые задания раскрытыми и сдаёт ответ; принятое свёрнуто', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? MINE : [{ ...MINE[0], status: 'PENDING', isNew: false }, MINE[1]]) as never);
  renderApp(<StudentAssignments />);
  const list = await screen.findByRole('list', { name: 'Задания' });
  const [fresh, done] = within(list).getAllByRole('listitem').filter((li) => li.parentElement === list);
  expect(within(fresh).getByText('Новое')).toBeVisible();
  expect(within(done).getByText('Принято')).toBeVisible();
  expect(within(done).queryByText('Молодец')).not.toBeInTheDocument();
  fireEvent.click(within(done).getByRole('button', { name: 'Подробнее: Решить задачи 1–5' }));
  expect(within(done).getByText('Молодец')).toBeVisible();
  expect(within(done).queryByRole('button', { name: 'Сдать ответ' })).not.toBeInTheDocument();

  fireEvent.change(within(fresh).getByLabelText('Текст ответа, если нужен'), { target: { value: 'Нарисовала листья' } });
  await act(async () => fireEvent.click(within(fresh).getByRole('button', { name: 'Сдать ответ' })));
  const [, path, body] = api.mock.calls.find(([method]) => method === 'POST')!;
  expect(path).toBe('/student/assignments/a2/answers');
  expect((body as FormData).get('text')).toBe('Нарисовала листья');
  expect(await screen.findByText('Ответ отправлен преподавателю')).toBeVisible();
  expect(within(fresh).getByText('На проверке')).toBeVisible();
});
