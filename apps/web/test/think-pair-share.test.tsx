import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThinkPairShare } from '../src/features/lesson/components/ThinkPairShare';
import { PLAN_KEY, defaultPlan, restorePlan, stageMinutes } from '../src/features/lesson/think-pair-share';
import { LessonPage } from '../src/pages/teacher/Lesson';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

const TITLE = 'Подумай — обсуди — поделись';

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); sessionStorage.clear(); });

const open = () => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${TITLE}`) }));
const clock = () => screen.getByRole('timer', { name: 'Осталось на этапе' });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const currentStage = () => screen.getByRole('listitem', { current: 'step' });

function renderTool(groupId = 'g1') {
  return renderApp(<ThinkPairShare key={groupId} groupId={groupId} projector={false} target={null} />);
}
function startOneMinuteStages() {
  const view = renderTool(); open();
  for (const label of ['Подумай, мин', 'Обсуди, мин', 'Поделись, мин']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: '1' } });
  }
  click('Начать');
  return view;
}

it('длительности: целое число минут от 1 до 30 на каждый этап', () => {
  expect(stageMinutes(['1', '30', '5'])).toEqual([1, 30, 5]);
  for (const bad of [['0', '2', '3'], ['31', '2', '3'], ['', '2', '3'], ['a', '2', '3']]) expect(stageMinutes(bad)).toBeNull();
  renderTool(); open();
  expect(screen.getByLabelText('Подумай, мин')).toHaveValue('1');
  fireEvent.change(screen.getByLabelText('Обсуди, мин'), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: 'Начать' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Обсуди, мин'), { target: { value: '4' } });
  expect(screen.getByRole('button', { name: 'Начать' })).toBeEnabled();
});

it('этап не переключается сам: по окончании можно добавить минуту или перейти дальше', () => {
  vi.useFakeTimers();
  startOneMinuteStages();
  expect(currentStage()).toHaveTextContent('1. Подумай');
  expect(clock()).toHaveTextContent('01:00');
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole('status')).toHaveTextContent('Время вышло!');
  act(() => vi.advanceTimersByTime(60_000));
  expect(currentStage()).toHaveTextContent('1. Подумай');
  expect(clock()).toHaveTextContent('00:00');
  click('Ещё минута');
  expect(clock()).toHaveTextContent('01:00');
  expect(screen.getByRole('status')).toHaveTextContent('Этап 1 из 3: Подумай. Идёт отсчёт');
  click('Дальше: Обсуди');
  expect(currentStage()).toHaveTextContent('2. Обсуди');
  expect(clock()).toHaveTextContent('01:00');
});

it('последний этап не предлагает следующего, «Завершить» возвращает к настройке с теми же минутами', () => {
  vi.useFakeTimers();
  renderTool(); open();
  fireEvent.change(screen.getByLabelText('Поделись, мин'), { target: { value: '7' } });
  click('Начать');
  click('Дальше: Обсуди');
  click('Дальше: Поделись');
  expect(clock()).toHaveTextContent('07:00');
  expect(screen.queryByRole('button', { name: /^Дальше/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Пауза' })).toHaveFocus();
  click('Завершить');
  expect(screen.getByLabelText('Поделись, мин')).toHaveValue('7');
  expect(screen.getByRole('button', { name: 'Начать' })).toHaveFocus();
});

it('пауза останавливает этап, а окончание оставляет фокус на той же кнопке', () => {
  vi.useFakeTimers();
  startOneMinuteStages();
  act(() => vi.advanceTimersByTime(10_000));
  click('Пауза');
  act(() => vi.advanceTimersByTime(60_000));
  expect(clock()).toHaveTextContent('00:50');
  click('Продолжить');
  const button = screen.getByRole('button', { name: 'Пауза' });
  expect(button).toHaveFocus();
  act(() => vi.advanceTimersByTime(50_000));
  expect(button).toHaveFocus();
  expect(button).toHaveTextContent('Ещё минута');
});

it('перезагрузка сохраняет этап и отсчёт, у другой группы они свои', () => {
  vi.useFakeTimers();
  const first = startOneMinuteStages();
  click('Дальше: Обсуди');
  act(() => vi.advanceTimersByTime(20_000));
  first.unmount();
  const other = renderTool('g2'); open();
  expect(screen.getByRole('button', { name: 'Начать' })).toBeVisible();
  other.unmount();
  renderTool();
  expect(currentStage()).toHaveTextContent('2. Обсуди');
  expect(clock()).toHaveTextContent('00:40');
});

it('этап остаётся тем же при переносе в проектор', () => {
  vi.useFakeTimers();
  const target = document.createElement('div'); document.body.append(target);
  const view = renderTool(); open();
  click('Начать');
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть этапы' }));
  expect(screen.getByRole('button', { name: /Подумай 00:59/ })).toHaveFocus();
  view.rerender(<ThinkPairShare key="g1" groupId="g1" projector target={target} />);
  expect(within(target).getByRole('timer')).toHaveTextContent('00:59');
  expect(within(target).queryByRole('button', { name: 'Скрыть этапы' })).not.toBeInTheDocument();
  view.rerender(<ThinkPairShare key="g1" groupId="g1" projector={false} target={null} />);
  expect(clock()).toHaveTextContent('00:59');
  view.unmount(); target.remove();
});

it('звук звучит в конце этапа, но не при переходе раньше срока', async () => {
  vi.useFakeTimers();
  const oscillator = vi.fn(() => ({ type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }));
  vi.stubGlobal('AudioContext', class {
    state = 'running'; currentTime = 0; destination = {};
    resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined);
    createOscillator = oscillator;
    createGain = () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} });
  });
  renderTool(); open();
  await act(async () => fireEvent.click(screen.getByRole('checkbox', { name: 'Звук в конце этапа' })));
  click('Начать');
  click('Дальше: Обсуди');
  expect(oscillator).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(120_000));
  expect(oscillator).toHaveBeenCalledTimes(2);
});

it('повреждённые записи и недоступное хранилище не мешают работе', () => {
  for (const raw of ['oops', 'null', JSON.stringify({ ...defaultPlan(), stage: 5 }), JSON.stringify({ ...defaultPlan(), minutes: [1, 2] }), JSON.stringify({ ...defaultPlan(), minutes: [0, 2, 3] })]) {
    expect(restorePlan(raw)).toEqual(defaultPlan());
  }
  sessionStorage.setItem(PLAN_KEY + 'g1', 'oops');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  renderTool(); open();
  click('Начать');
  expect(clock()).toHaveTextContent('01:00');
});

it('в архивной группе инструмента нет, в пустой активной он доступен', () => {
  const view = renderInGroup(<LessonPage />, groupData({ archivedAt: new Date().toISOString() }));
  expect(screen.queryByRole('region', { name: TITLE })).not.toBeInTheDocument();
  view.unmount();
  const data = groupData(); data.students = [];
  renderInGroup(<LessonPage />, data);
  expect(screen.getByRole('button', { name: TITLE })).toBeVisible();
});
