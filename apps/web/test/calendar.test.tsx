import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Calendar } from '../src/features/calendar/components/Calendar';
import { GroupCalendar } from '../src/features/calendar/components/GroupCalendar';
import type { ClassEvent } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
const PATH = '/teacher/groups/g1/events';
const EVENT: ClassEvent = { id: 'e1', title: 'Контрольная', description: 'Глава 3', date: '2026-11-20', time: '09:30', remindDays: 2 };

beforeEach(() => {
  api.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
});
afterEach(() => { vi.useRealTimers(); });

function reply(events: ClassEvent[]) {
  api.mockImplementation(async (method) => (method === 'GET' ? events : EVENT) as never);
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

it('показывает текущий месяц, события и подпись дня; листаются соседние месяцы', async () => {
  reply([EVENT, { ...EVENT, id: 'e2', title: 'Экскурсия', time: null, date: '2026-11-10' }]);
  renderApp(<Calendar path={PATH} />);
  expect(await screen.findByText('Контрольная')).toBeVisible();
  expect(api).toHaveBeenCalledWith('GET', `${PATH}?month=2026-11`);
  expect(screen.getByRole('heading', { name: 'Ноябрь 2026' })).toBeVisible();
  expect(screen.getByText('Сегодня')).toBeVisible();
  expect(screen.getByText('День')).toBeVisible();
  click('Следующий месяц');
  expect(api).toHaveBeenLastCalledWith('GET', `${PATH}?month=2026-12`);
  click('Следующий месяц');
  expect(api).toHaveBeenLastCalledWith('GET', `${PATH}?month=2027-01`);
  click('Предыдущий месяц');
  expect(api).toHaveBeenLastCalledWith('GET', `${PATH}?month=2026-12`);
  click('Сегодня');
  expect(api).toHaveBeenLastCalledWith('GET', `${PATH}?month=2026-11`);
});

it('ученик и родитель не видят кнопок изменения', async () => {
  reply([EVENT]);
  renderApp(<Calendar path="/student/events" />);
  expect(await screen.findByText('Контрольная')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Событие' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Изменить/ })).not.toBeInTheDocument();
});

it('пустой месяц объясняется по-разному для преподавателя и ученика', async () => {
  reply([]);
  const view = renderApp(<Calendar path={PATH} editable />);
  expect(await screen.findByText(/Добавьте контрольные/)).toBeVisible();
  view.unmount();
  renderApp(<Calendar path="/student/events" />);
  expect(await screen.findByText(/Когда преподаватель добавит событие/)).toBeVisible();
});

it('новое событие: без названия нельзя, напоминание и время уходят в запросе', async () => {
  reply([]);
  renderApp(<Calendar path={PATH} editable />);
  await screen.findByText(/Добавьте контрольные/);
  click('Событие');
  expect(screen.getByLabelText('Дата')).toHaveValue('2026-11-10');
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: ' Собрание ' } });
  fireEvent.change(screen.getByLabelText('Время, если нужно'), { target: { value: '18:00' } });
  fireEvent.change(screen.getByLabelText('Напоминание'), { target: { value: '1' } });
  await act(async () => click('Сохранить'));
  expect(api).toHaveBeenCalledWith('POST', PATH, { title: 'Собрание', description: '', date: '2026-11-10', time: '18:00', remindDays: 1 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.mock.calls.filter(([method]) => method === 'GET')).toHaveLength(2);
});

it('в другом месяце дата нового события начинается с этого месяца', async () => {
  reply([]);
  renderApp(<Calendar path={PATH} editable />);
  click('Следующий месяц');
  await screen.findByText(/Добавьте контрольные/);
  click('Событие');
  expect(screen.getByLabelText('Дата')).toHaveValue('2026-12-01');
});

it('изменение подставляет значения, событие на весь день уходит без времени', async () => {
  reply([EVENT]);
  renderApp(<Calendar path={PATH} editable />);
  fireEvent.click(await screen.findByRole('button', { name: 'Изменить: Контрольная' }));
  expect(screen.getByLabelText('Название')).toHaveValue('Контрольная');
  expect(screen.getByLabelText('Напоминание')).toHaveValue('2');
  fireEvent.change(screen.getByLabelText('Время, если нужно'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Напоминание'), { target: { value: '' } });
  await act(async () => click('Сохранить'));
  expect(api).toHaveBeenCalledWith('PUT', `${PATH}/e1`, {
    title: 'Контрольная', description: 'Глава 3', date: '2026-11-20', time: null, remindDays: null,
  });
});

it('событие удаляется, ошибка оставляет окно открытым', async () => {
  reply([EVENT]);
  renderApp(<Calendar path={PATH} editable />);
  fireEvent.click(await screen.findByRole('button', { name: 'Изменить: Контрольная' }));
  api.mockRejectedValueOnce(new Error('Группа в архиве'));
  await act(async () => click('Удалить'));
  expect(await screen.findByText('Группа в архиве')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
  await act(async () => click('Удалить'));
  expect(api).toHaveBeenCalledWith('DELETE', `${PATH}/e1`);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('в архивной группе календарь только для чтения', async () => {
  reply([EVENT]);
  renderInGroup(<GroupCalendar />, groupData({ archivedAt: '2026-10-01T00:00:00.000Z' }));
  expect(await screen.findByText('Контрольная')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Событие' })).not.toBeInTheDocument();
});
