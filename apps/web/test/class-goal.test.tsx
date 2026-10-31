import { beforeEach, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { ClassGoalPanel } from '../src/features/goals/components/ClassGoal';
import { LessonPage } from '../src/pages/teacher/Lesson';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const { api } = await import('../src/lib/api');
const goal = { id: 'goal-1', title: 'Киноурок', target: 5, earned: 4, reached: false, createdAt: '2026-10-29T09:00:00Z' };
beforeEach(() => { vi.mocked(api).mockReset(); });

it('создание цели: ошибка сохраняет введённые данные, повторная попытка передаёт цель группе', async () => {
  const onChange = vi.fn();
  vi.mocked(api).mockRejectedValueOnce(new Error('Нет связи с сервером')).mockResolvedValueOnce({ ...goal, earned: 0 });
  const { user } = renderApp(<ClassGoalPanel goal={null} groupId="g1" archived={false} onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: 'Задать цель класса' }));
  await user.type(screen.getByLabelText('Что сделаем вместе?'), 'Киноурок');
  await user.clear(screen.getByLabelText('Сколько баллов нужно собрать?'));
  await user.type(screen.getByLabelText('Сколько баллов нужно собрать?'), '5');
  await user.click(screen.getByRole('button', { name: 'Начать собирать' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи');
  expect(screen.getByLabelText('Что сделаем вместе?')).toHaveValue('Киноурок');
  await user.click(screen.getByRole('button', { name: 'Начать собирать' }));
  expect(onChange).toHaveBeenCalledWith({ ...goal, earned: 0 });
});

it('новое начисление достигает цели; отмена восстанавливает актуальный прогресс', async () => {
  const data = groupData();
  data.classGoal = goal;
  vi.mocked(api).mockImplementation(async (_method: string, path: string) => {
    if (path.endsWith('/points')) return { value: 2, eventIds: ['e1'], summaries: { s1: { todayEarned: 2, totalEarned: 6, level: 1 } }, classGoal: { ...goal, earned: 6, reached: true } };
    if (path === '/teacher/points/undo') return { summaries: { s1: { todayEarned: 0, totalEarned: 4, level: 1 } } };
    if (path.endsWith('/goal')) return goal;
    throw new Error(`Неожиданный путь: ${path}`);
  });
  const { user } = renderInGroup(<LessonPage />, data);
  expect(screen.getByRole('progressbar', { name: 'Цель класса: Киноурок' })).toHaveAttribute('aria-valuetext', '4 из 5 баллов');
  await user.click(screen.getByRole('button', { name: /^Маша Иванова/ }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Отличная работа/ }));
  expect(await screen.findByText('Цель достигнута!')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await user.click(screen.getByRole('button', { name: 'Отменить' }));
  expect(await screen.findByText('Осталось 1 балл')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
});

it('проектор и архив показывают цель без кнопок изменения', () => {
  const view = renderApp(<ClassGoalPanel goal={goal} groupId="g1" archived={false} projector />);
  expect(screen.getByText('Собрано 4 из 5 баллов')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.unmount();
  renderApp(<ClassGoalPanel goal={goal} groupId="g1" archived onChange={vi.fn()} />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
