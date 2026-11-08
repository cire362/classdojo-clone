import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TermsProvider } from '../src/features/auth';
import { AdminSubjects, GroupSubjects, SubjectSummaryTable } from '../src/features/subjects';
import { LessonPage } from '../src/pages/teacher/Lesson';
import type { GroupSubject, Subject } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
  localStorage.clear();
});

const PHYSICS: GroupSubject = { id: 'l1', subject: { id: 'phys', name: 'Физика' }, teacher: { id: 't2', name: 'Ольга Петровна' } };
const CATALOG: Subject[] = [{ id: 'phys', name: 'Физика', groups: 1 }];

it('на уроке выбирается дисциплина: баллы уходят с ней, выбор запоминается для группы', async () => {
  api.mockImplementation(async (_m, _p, body) => {
    const { studentIds } = body as { studentIds: string[] };
    const summaries = Object.fromEntries(studentIds.map((id) => [id, { todayEarned: 2, totalEarned: 6, level: 1 }]));
    return { value: 2, eventIds: ['e1'], summaries } as never;
  });
  const data = { ...groupData(), subjects: [PHYSICS] };
  const { user, unmount } = renderInGroup(<LessonPage />, data);
  const picker = screen.getByLabelText('Предмет');
  expect(picker).toHaveDisplayValue('Без предмета');
  await user.selectOptions(picker, 'Физика');
  await user.click(screen.getByRole('button', { name: /^Маша Иванова/ }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Отличная работа/ }));
  expect(api).toHaveBeenCalledWith('POST', '/teacher/groups/g1/points', { studentIds: ['s1'], reasonId: 'r1', subjectId: 'phys' });
  unmount();
  renderInGroup(<LessonPage />, data);
  expect(screen.getByLabelText('Предмет')).toHaveDisplayValue('Физика');
});

it('без дисциплин у группы выбора на уроке нет', () => {
  renderInGroup(<LessonPage />, groupData());
  expect(screen.queryByLabelText('Предмет')).not.toBeInTheDocument();
});

it('создатель группы заводит новую дисциплину и назначает преподавателя', async () => {
  api.mockImplementation(async (method, path) => {
    if (path === '/teacher/school-teachers') return [{ id: 't2', name: 'Ольга Петровна' }] as never;
    if (path === '/teacher/subjects') return (method === 'GET' ? [] : CATALOG) as never;
    return [PHYSICS] as never;
  });
  const onChange = vi.fn(async () => {});
  renderApp(
    <TermsProvider kind="COLLEGE">
      <GroupSubjects groupId="g1" subjects={[]} canEdit onChange={onChange} />
    </TermsProvider>,
  );
  expect(screen.getByText('Дисциплины не назначены: баллы и уроки идут без них.')).toBeVisible();
  await screen.findByRole('option', { name: 'Ольга Петровна' });
  fireEvent.change(screen.getByLabelText('Дисциплина'), { target: { value: '__new' } });
  fireEvent.change(screen.getByLabelText('Название дисциплины'), { target: { value: ' Физика ' } });
  fireEvent.change(screen.getByLabelText('Преподаватель'), { target: { value: 't2' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Назначить' })));
  expect(api).toHaveBeenCalledWith('POST', '/teacher/subjects', { name: 'Физика' });
  expect(api).toHaveBeenCalledWith('POST', '/teacher/groups/g1/subjects', { subjectId: 'phys', teacherId: 't2' });
  expect(onChange).toHaveBeenCalled();
});

it('соавтор видит дисциплины группы, но не меняет их', () => {
  renderApp(
    <TermsProvider kind="UNIVERSITY">
      <GroupSubjects groupId="g1" subjects={[PHYSICS]} canEdit={false} onChange={async () => {}} />
    </TermsProvider>,
  );
  expect(within(screen.getByRole('list', { name: 'Дисциплины' })).getByText('Ольга Петровна')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Убрать «Физика»' })).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

it('сводка по дисциплинам: уроки, посещаемость, плюсы и минусы', async () => {
  api.mockResolvedValue([
    { subject: { id: 'phys', name: 'Физика' }, lessons: 3, attendance: 0.75, earned: 12, lost: 2 },
    { subject: null, lessons: 0, attendance: null, earned: 1, lost: 0 },
  ] as never);
  renderApp(
    <TermsProvider kind="COLLEGE">
      <SubjectSummaryTable groupId="g1" from="2026-11-02" to="2026-11-08" />
    </TermsProvider>,
  );
  expect(await screen.findByRole('heading', { name: 'По дисциплинам' })).toBeVisible();
  const [, physics, none] = screen.getAllByRole('row');
  expect(physics).toHaveTextContent('Физика375%+12−2');
  expect(none).toHaveTextContent('Без дисциплины0—+1−0');
  expect(api).toHaveBeenCalledWith('GET', '/teacher/groups/g1/subjects/summary?from=2026-11-02&to=2026-11-08');
});

it('администрация школы ведёт каталог предметов', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? CATALOG : [...CATALOG, { id: 'chem', name: 'Химия', groups: 0 }]) as never);
  renderApp(<AdminSubjects canEdit />);
  expect(await screen.findByRole('heading', { name: 'Предметы' })).toBeVisible();
  expect(screen.getByText('1 группа')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Новая запись'), { target: { value: 'Химия' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Добавить' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/subjects', { name: 'Химия' });
  expect(await screen.findByText('Химия')).toBeVisible();
});
