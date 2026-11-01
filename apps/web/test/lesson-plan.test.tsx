import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { LessonPlanPanel } from '../src/features/lesson/components/LessonPlanPanel';
import type { LessonPlan } from '../src/lib/api';
import { LessonPage } from '../src/pages/teacher/Lesson';
import { groupData, renderInGroup } from './group-harness';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

function withPlan(plan: LessonPlan) {
  const data = groupData();
  data.plan = plan;
  return data;
}
const PLAN = { steps: ['Разминка', 'Новая тема', 'Итоги'], current: 0 };
const open = () => fireEvent.click(screen.getByRole('button', { name: /^План урока/ }));
const button = (name: string) => screen.getByRole('button', { name });
const area = () => screen.getByLabelText('Шаги урока, по одному на строку');
const replyWith = () => api.mockImplementation(async (_m, path, body) => {
  const b = body as { steps?: string[]; current?: number };
  return (path.endsWith('/current') ? { ...PLAN, current: b.current } : { steps: b.steps, current: 0 }) as never;
});

it('без плана кнопка открывает редактор; пустые строки отбрасываются', async () => {
  replyWith();
  renderInGroup(<LessonPage />, groupData());
  open();
  expect(area()).toHaveFocus();
  expect(button('Сохранить')).toBeDisabled();
  fireEvent.change(area(), { target: { value: ' Разминка \n\n  \nИтоги\n' } });
  fireEvent.click(button('Сохранить'));
  await screen.findByText('Сейчас, шаг 1 из 2');
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/plan', { steps: ['Разминка', 'Итоги'] });
  expect(button('Следующий шаг')).toHaveFocus();
});

it('лимиты видны сразу: больше 20 шагов или длинный шаг не сохранить', () => {
  renderInGroup(<LessonPage />, groupData());
  open();
  fireEvent.change(area(), { target: { value: Array.from({ length: 21 }, (_, i) => `Шаг ${i}`).join('\n') } });
  expect(button('Сохранить')).toBeDisabled();
  fireEvent.change(area(), { target: { value: 'я'.repeat(201) } });
  expect(button('Сохранить')).toBeDisabled();
  fireEvent.change(area(), { target: { value: 'я'.repeat(200) } });
  expect(button('Сохранить')).toBeEnabled();
});

it('шаги переключаются кнопками и по списку; на кнопке виден прогресс', async () => {
  replyWith();
  renderInGroup(<LessonPage />, withPlan(PLAN));
  expect(screen.getByRole('button', { name: /План урока · 1 из 3/ })).toBeVisible();
  open();
  expect(button('Следующий шаг')).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('Сейчас, шаг 1 из 3');
  expect(screen.getByText('Дальше: Новая тема')).toBeVisible();
  fireEvent.click(button('Следующий шаг'));
  await screen.findByText('Сейчас, шаг 2 из 3');
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/plan/current', { current: 1 });
  fireEvent.click(within(screen.getByRole('list', { name: 'Порядок шагов' })).getByRole('button', { name: /Итоги/ }));
  await screen.findByText('Сейчас, шаг 3 из 3');
  expect(screen.queryByText(/^Дальше:/)).not.toBeInTheDocument();
});

it('на краях плана лишнего запроса нет, а кнопка не теряет фокус', async () => {
  replyWith();
  renderInGroup(<LessonPage />, withPlan({ ...PLAN, current: 2 }));
  open();
  const next = button('Следующий шаг');
  expect(next).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(next);
  expect(api).not.toHaveBeenCalled();
  expect(next).toHaveFocus();
});

it('ошибка сервера остаётся на том же шаге и показывается', async () => {
  api.mockRejectedValue(new Error('План изменился, обновите страницу'));
  renderInGroup(<LessonPage />, withPlan(PLAN));
  open();
  fireEvent.click(button('Следующий шаг'));
  expect(await screen.findByText('План изменился, обновите страницу')).toBeVisible();
  expect(screen.getByText('Сейчас, шаг 1 из 3')).toBeVisible();
});

it('изменение подставляет текущие шаги, отмена их сохраняет, очистка убирает план', async () => {
  replyWith();
  renderInGroup(<LessonPage />, withPlan(PLAN));
  open();
  fireEvent.click(button('Изменить'));
  expect(area()).toHaveValue('Разминка\nНовая тема\nИтоги');
  fireEvent.click(button('Отмена'));
  expect(button('Следующий шаг')).toHaveFocus();
  fireEvent.click(button('Изменить'));
  fireEvent.click(button('Очистить план'));
  await waitFor(() => expect(area()).toHaveValue(''));
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/groups/g1/plan', { steps: [] });
  expect(area()).toHaveFocus();
});

it('на проекторе план открыт сам, без редактирования; скрыть его можно', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  renderInGroup(<LessonPlanPanel projector target={target} />, withPlan(PLAN));
  const screenView = within(target);
  expect(screenView.getByText('Разминка', { selector: 'p' })).toBeVisible();
  expect(screenView.queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument();
  act(() => fireEvent.click(screenView.getByRole('button', { name: 'Скрыть план урока' })));
  expect(screenView.getByRole('button', { name: /План урока/ })).toHaveFocus();
  target.remove();
});

it('пустой план на проекторе не показывается', () => {
  const target = document.createElement('div');
  document.body.append(target);
  renderInGroup(<LessonPlanPanel projector target={target} />, groupData());
  expect(target).toBeEmptyDOMElement();
  target.remove();
});

it('в архивной группе плана нет', () => {
  renderInGroup(<LessonPage />, groupData({ archivedAt: new Date().toISOString() }));
  expect(screen.queryByRole('region', { name: 'План урока' })).not.toBeInTheDocument();
});
