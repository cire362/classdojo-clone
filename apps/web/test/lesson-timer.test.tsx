import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LessonTimer } from '../src/components/LessonTimer';
import { LessonPage } from '../src/pages/teacher/Lesson';
import { TIMER_KEY, TIMER_MAX_MS, idleTimer, restoreTimer, startTimer, timerDuration } from '../src/lib/lesson-timer';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); sessionStorage.clear(); });

const open = () => fireEvent.click(screen.getByRole('button', { name: /^Таймер/ }));
const clock = () => screen.getByRole('timer', { name: 'Осталось времени' });
function duration(minutes: string, seconds: string) {
  fireEvent.change(screen.getByLabelText('Минуты'), { target: { value: minutes } });
  fireEvent.change(screen.getByLabelText('Секунды'), { target: { value: seconds } });
}
function renderTimer(groupId = 'g1') {
  return renderApp(<LessonTimer key={groupId} groupId={groupId} projector={false} target={null} />);
}

it('пресеты и свои секунды: границы 00:01–99:59, ноль и 60 секунд не запускаются', () => {
  expect(timerDuration('99', '59')).toBe(TIMER_MAX_MS);
  expect(timerDuration('0', '0')).toBeNull();
  expect(timerDuration('1', '60')).toBeNull();
  renderTimer(); open();
  fireEvent.click(screen.getByRole('button', { name: '3 мин' }));
  expect(clock()).toHaveTextContent('03:00');
  duration('0', '0');
  expect(screen.getByRole('button', { name: 'Начать' })).toBeDisabled();
  duration('1', '60');
  expect(screen.getByRole('button', { name: 'Начать' })).toBeDisabled();
  duration('0', '1');
  expect(screen.getByRole('button', { name: 'Начать' })).toBeEnabled();
});

it('пауза хранит точный остаток; время на паузе не уходит, продолжение и сброс работают', () => {
  vi.useFakeTimers();
  renderTimer(); open(); duration('0', '5');
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  act(() => vi.advanceTimersByTime(1250));
  fireEvent.click(screen.getByRole('button', { name: 'Пауза' }));
  expect(clock()).toHaveTextContent('00:04');
  expect(JSON.parse(sessionStorage.getItem(TIMER_KEY + 'g1')!).remainingMs).toBe(3750);
  act(() => vi.advanceTimersByTime(60_000));
  expect(clock()).toHaveTextContent('00:04');
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  act(() => vi.advanceTimersByTime(750));
  expect(clock()).toHaveTextContent('00:03');
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  expect(clock()).toHaveTextContent('00:05');
  expect(screen.getByRole('button', { name: 'Начать' })).toBeVisible();
});

it('возвращение на вкладку после задержки сразу завершает отсчёт и не уходит в минус', () => {
  vi.useFakeTimers();
  renderTimer(); open(); duration('0', '2');
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  act(() => { vi.setSystemTime(Date.now() + 60_000); document.dispatchEvent(new Event('visibilitychange')); });
  expect(clock()).toHaveTextContent('00:00');
  expect(screen.getByRole('status')).toHaveTextContent('Время вышло!');
  act(() => vi.advanceTimersByTime(1000));
  expect(clock()).toHaveTextContent('00:00');
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  expect(clock()).toHaveTextContent('00:02');
});

it('перезагрузка и смена группы сохраняют только её таймер, без потери времени', () => {
  vi.useFakeTimers();
  let view = renderTimer(); open(); duration('0', '10');
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  act(() => vi.advanceTimersByTime(1250));
  view.unmount();
  act(() => vi.setSystemTime(Date.now() + 2000));
  view = renderTimer('g2'); open();
  expect(clock()).toHaveTextContent('05:00');
  view.unmount();
  view = renderTimer();
  expect(clock()).toHaveTextContent('00:07');
  view.unmount();
});

it('таймер остаётся тем же при переносе в проектор и выходе из него', () => {
  vi.useFakeTimers();
  const target = document.createElement('div'); document.body.append(target);
  const view = renderTimer(); open(); duration('0', '4');
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  act(() => vi.advanceTimersByTime(1000));
  view.rerender(<LessonTimer key="g1" groupId="g1" projector target={target} />);
  expect(within(target).getByRole('timer')).toHaveTextContent('00:03');
  act(() => vi.advanceTimersByTime(1000));
  view.rerender(<LessonTimer key="g1" groupId="g1" projector={false} target={null} />);
  expect(clock()).toHaveTextContent('00:02');
  view.unmount(); target.remove();
});

it('повреждённые записи восстанавливаются безопасно, истёкшая запись показывается завершённой', () => {
  const now = Date.now();
  for (const raw of ['oops', 'null', JSON.stringify({ ...idleTimer(), durationMs: -1 }), JSON.stringify({ ...startTimer(1000, now), endsAt: Infinity }), JSON.stringify({ ...idleTimer(), remainingMs: 9999999 })]) {
    expect(restoreTimer(raw, now)).toEqual(idleTimer());
  }
  expect(restoreTimer(JSON.stringify(startTimer(1000, now - 5000)), now).status).toBe('finished');
  sessionStorage.setItem(TIMER_KEY + 'g1', 'oops');
  renderTimer(); open(); expect(clock()).toHaveTextContent('05:00');
});

it('управление с клавиатуры не теряет фокус при запуске, паузе, сбросе и скрытии', () => {
  renderTimer(); open();
  expect(screen.getByRole('button', { name: 'Начать' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  expect(screen.getByRole('button', { name: 'Пауза' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Пауза' }));
  expect(screen.getByRole('button', { name: 'Продолжить' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  expect(screen.getByRole('button', { name: 'Начать' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть таймер' }));
  expect(screen.getByRole('button', { name: 'Таймер' })).toHaveFocus();
});

it('недоступное хранилище не мешает отсчёту', () => {
  vi.useFakeTimers();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  renderTimer(); open(); duration('0', '1');
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  act(() => vi.advanceTimersByTime(1000));
  expect(clock()).toHaveTextContent('00:00');
});

it.each(['Пауза', 'Сбросить'])('окончание сохраняет фокус на кнопке «%s», не удаляя её', (name) => {
  vi.useFakeTimers();
  renderTimer(); open(); duration('0', '1');
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  const button = screen.getByRole('button', { name });
  button.focus();
  act(() => vi.advanceTimersByTime(1000));
  expect(clock()).toHaveTextContent('00:00');
  expect(button).toHaveFocus();
  expect(button).toHaveTextContent(name === 'Пауза' ? 'Начать снова' : 'Сбросить');
});

it('окончание не забирает фокус из другой части страницы', () => {
  vi.useFakeTimers();
  renderApp(<><button>Другое действие</button><LessonTimer groupId="g1" projector={false} target={null} /></>);
  open(); duration('0', '1');
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  const outside = screen.getByRole('button', { name: 'Другое действие' });
  outside.focus();
  act(() => vi.advanceTimersByTime(1000));
  expect(clock()).toHaveTextContent('00:00');
  expect(outside).toHaveFocus();
});

it('звук включается явно и звучит один раз при окончании, а не при повторном открытии', async () => {
  vi.useFakeTimers();
  const oscillator = vi.fn(() => ({ type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }));
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('AudioContext', class {
    state = 'running'; currentTime = 0; destination = {};
    resume = vi.fn().mockResolvedValue(undefined); close = close;
    createOscillator = oscillator;
    createGain = () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} });
  });
  const view = renderTimer(); open(); duration('0', '1');
  await act(async () => fireEvent.click(screen.getByRole('checkbox', { name: 'Звук по окончании' })));
  expect(screen.getByRole('checkbox')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
  act(() => vi.advanceTimersByTime(1000));
  expect(oscillator).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть таймер' })); open();
  act(() => vi.advanceTimersByTime(5000));
  expect(oscillator).toHaveBeenCalledTimes(2);
  view.unmount(); expect(close).toHaveBeenCalledOnce();
});

it('недоступный звук объясняется после попытки включить его; работа продолжается', async () => {
  vi.stubGlobal('AudioContext', undefined);
  renderTimer(); open();
  await act(async () => fireEvent.click(screen.getByRole('checkbox', { name: 'Звук по окончании' })));
  expect(screen.getByText('Звук недоступен. Таймер продолжает работать.')).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

it('в архивной группе таймер скрыт, а в пустой активной группе доступен', () => {
  const view = renderInGroup(<LessonPage />, groupData({ archivedAt: new Date().toISOString() }));
  expect(screen.queryByRole('region', { name: 'Таймер урока' })).not.toBeInTheDocument();
  view.unmount();
  const data = groupData(); data.students = [];
  renderInGroup(<LessonPage />, data);
  expect(screen.getByRole('button', { name: 'Таймер' })).toBeVisible();
});
