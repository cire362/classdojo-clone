import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SchoolPointsPanel } from '../src/features/schoolpoints/components/SchoolPointsPanel';
import { TeacherSchoolPoints } from '../src/features/schoolpoints/components/TeacherSchoolPoints';
import type { ClassRatingRow, SchoolGoal, SchoolPoints } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const GOAL: SchoolGoal = {
  id: 'g', title: 'Школьный пикник', target: 1000, earned: 250, reached: false, createdAt: '2026-11-01T00:00:00.000Z',
};
const ROWS: ClassRatingRow[] = [
  { groupId: 'a', groupName: '3 «А»', teacherName: 'Анна', students: 20, earned: 60, perStudent: 3, place: 1, mine: false },
  { groupId: 'b', groupName: '5 «Б»', teacherName: 'Игорь', students: 25, earned: 50, perStudent: 2, place: 2, mine: true },
];
const POINTS: SchoolPoints = { goal: GOAL, period: 'week', from: '2026-11-02T00:00:00.000Z', rating: ROWS };

it('преподаватель видит цель школы и рейтинг со своим классом; период меняется', async () => {
  api.mockResolvedValue(POINTS as never);
  renderApp(<TeacherSchoolPoints />);
  expect(await screen.findByText('Все классы собрали 250 из 1000 баллов')).toBeVisible();
  const places = screen.getByRole('list', { name: 'Места классов' });
  const [first, second] = within(places).getAllByRole('listitem');
  expect(first).toHaveTextContent('1 место');
  expect(first).toHaveTextContent('3 на ученика');
  expect(within(second).getByText('Ваш класс')).toBeVisible();
  expect(places).not.toHaveTextContent(/Маша|Петя/);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Месяц' })));
  expect(api).toHaveBeenCalledWith('GET', '/teacher/school-points?period=month');
});

it('без цели и с одним классом у преподавателя ничего не показывается', async () => {
  api.mockResolvedValue({ ...POINTS, goal: null, rating: [ROWS[0]] } as never);
  renderApp(<TeacherSchoolPoints />);
  await act(async () => undefined);
  expect(api).toHaveBeenCalled();
  expect(screen.queryByText(/Цель школы|Рейтинг классов/)).not.toBeInTheDocument();
});

it('директор ставит цель школы и добавляет общую причину; сотрудник только смотрит', async () => {
  api.mockImplementation(async (method, path, body) => {
    if (path.startsWith('/admin/school-points')) return { ...POINTS, goal: null } as never;
    if (path === '/admin/school-reasons') return (method === 'GET' ? [] : [{ id: 'r1', ...(body as object) }]) as never;
    return { ...GOAL, ...(body as object), earned: 0 } as never;
  });
  renderApp(<SchoolPointsPanel canEdit />);
  fireEvent.click(await screen.findByRole('button', { name: /Задать цель школы/ }));
  fireEvent.change(screen.getByLabelText('Что сделаем все вместе?'), { target: { value: ' Пикник ' } });
  fireEvent.change(screen.getByLabelText('Сколько баллов собрать всем классам?'), { target: { value: '500' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('PUT', '/admin/school-goal', { title: 'Пикник', target: 500, restart: false });
  expect(screen.getByRole('heading', { name: 'Цель школы: Пикник' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: /Добавить причину/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Новая общая причина' });
  fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Дежурство' } });
  fireEvent.change(within(dialog).getByLabelText('Баллы'), { target: { value: '2' } });
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/school-reasons', { name: 'Дежурство', emoji: '⭐', value: 2 });
  expect(within(screen.getByRole('list', { name: 'Общие причины школы' })).getByText('+2')).toBeVisible();
});

it('сотрудник видит баллы школы без кнопок изменения', async () => {
  const reasons = [{ id: 'r1', name: 'Дежурство', emoji: '🧹', value: 2 }];
  api.mockImplementation(async (_m, path) => (path === '/admin/school-reasons' ? reasons : POINTS) as never);
  renderApp(<SchoolPointsPanel canEdit={false} />);
  expect(await screen.findByText('Дежурство')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Изменить/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Добавить причину/ })).not.toBeInTheDocument();
});

it('в списке причин класса общая причина школы отмечена и не меняется преподавателем', async () => {
  const { ReasonsManager } = await import('../src/features/reasons/components/ReasonsManager');
  const { groupData, renderInGroup } = await import('./group-harness');
  const data = groupData();
  data.reasons = [...data.reasons, { id: 'r3', name: 'Дежурство', emoji: '🧹', value: 2, school: true }];
  renderInGroup(<ReasonsManager />, data, 'reasons');
  expect(await screen.findByText('Дежурство')).toBeVisible();
  expect(screen.getByText('Школа')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Изменить «Отличная работа»' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Изменить «Дежурство»' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Удалить «Дежурство»' })).not.toBeInTheDocument();
});

it('в вузе рейтинг и цель говорят о группах и студентах', async () => {
  const { TermsProvider } = await import('../src/features/auth');
  api.mockResolvedValue(POINTS as never);
  renderApp(<TermsProvider kind="UNIVERSITY"><TeacherSchoolPoints /></TermsProvider>);
  expect(await screen.findByText('Все группы собрали 250 из 1000 баллов')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Цель вуза: Школьный пикник' })).toBeVisible();
  const places = screen.getByRole('list', { name: 'Места групп' });
  expect(places).toHaveTextContent('3 на студента');
  expect(within(places).getByText('Ваша группа')).toBeVisible();
  expect(places).toHaveTextContent('25 студентов');
});

it('экраны преподавателя в вузе говорят о студентах и группах', async () => {
  const { TermsProvider } = await import('../src/features/auth');
  const { GroupAssignments } = await import('../src/features/assignments/components/GroupAssignments');
  const { groupData, renderInGroup } = await import('./group-harness');
  api.mockResolvedValue([] as never);
  renderInGroup(<TermsProvider kind="UNIVERSITY"><GroupAssignments /></TermsProvider>, groupData(), 'assignments');
  expect(await screen.findByText(/нескольким студентам\. Студенты сдадут ответ/)).toBeVisible();
});
