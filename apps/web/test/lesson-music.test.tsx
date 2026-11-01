import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LessonMusic } from '../src/features/lesson/components/LessonMusic';
import { MUSIC_KEY, defaultMusic, midiToHz, restoreMusic, volumeGain } from '../src/features/lesson/music';
import { LessonPage } from '../src/pages/teacher/Lesson';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

const close = vi.fn();
const created: FakeContext[] = [];

class FakeContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  gains: { setTargetAtTime: ReturnType<typeof vi.fn> }[] = [];
  oscillators = 0;
  noise = 0;
  resume = async () => undefined;
  close = close;
  constructor() { created.push(this); }
  createOscillator() {
    this.oscillators++;
    return { type: '', frequency: { value: 0 }, connect() {}, disconnect() {}, start() {}, stop() {}, onended: null };
  }
  createGain() {
    const gain = { setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime: vi.fn(), value: 0 };
    this.gains.push(gain);
    return { gain, connect() {}, disconnect() {} };
  }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect() {} }; }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { this.noise++; return { buffer: null, loop: false, connect() {}, start() {} }; }
}

beforeEach(() => { localStorage.clear(); created.length = 0; close.mockReset(); close.mockResolvedValue(undefined); vi.stubGlobal('AudioContext', FakeContext); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

const open = () => fireEvent.click(screen.getByRole('button', { name: /^Музыка/ }));
const click = async (name: string) => { await act(async () => fireEvent.click(screen.getByRole('button', { name }))); };

it('ноты и громкость считаются верно, настройки восстанавливаются безопасно', () => {
  expect(midiToHz(69)).toBe(440);
  expect(volumeGain(0)).toBe(0);
  expect(volumeGain(100)).toBe(1);
  expect(volumeGain(50)).toBe(0.25);
  for (const raw of ['oops', 'null', JSON.stringify({ trackId: 'нет', volume: 10 }), JSON.stringify({ trackId: 'rain', volume: 101 })]) {
    expect(restoreMusic(raw)).toEqual(defaultMusic());
  }
  expect(restoreMusic(JSON.stringify({ trackId: 'rain', volume: 10 }))).toEqual({ trackId: 'rain', volume: 10 });
});

it('музыка включается и останавливается, контекст звука закрывается после затухания', async () => {
  vi.useFakeTimers();
  renderApp(<LessonMusic projector={false} target={null} />);
  open();
  expect(screen.getByRole('button', { name: 'Включить' })).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('Музыка выключена');
  await click('Включить');
  expect(screen.getByRole('status')).toHaveTextContent('Играет: Тихое утро');
  expect(created[0].oscillators).toBeGreaterThan(0);
  await click('Остановить');
  expect(close).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(2000));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByRole('status')).toHaveTextContent('Музыка выключена');
});

it('смена мелодии во время игры сразу запускает новую, а без игры только запоминается', async () => {
  renderApp(<LessonMusic projector={false} target={null} />);
  open();
  await click('Сосредоточение');
  expect(created).toHaveLength(0);
  await click('Включить');
  await click('Дождь за окном');
  expect(created).toHaveLength(2);
  expect(created[1].noise).toBe(1);
  expect(screen.getByRole('status')).toHaveTextContent('Играет: Дождь за окном');
  expect(JSON.parse(localStorage.getItem(MUSIC_KEY)!).trackId).toBe('rain');
});

it('громкость меняется на ходу и запоминается', async () => {
  renderApp(<LessonMusic projector={false} target={null} />);
  open();
  await click('Включить');
  fireEvent.change(screen.getByLabelText(/^Громкость/), { target: { value: '60' } });
  expect(created[0].gains[0].setTargetAtTime).toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(MUSIC_KEY)!).volume).toBe(60);
  expect(screen.getByText('Громкость: 60%')).toBeVisible();
});

it('уход с экрана урока останавливает музыку', async () => {
  vi.useFakeTimers();
  const view = renderApp(<LessonMusic projector={false} target={null} />);
  open();
  await click('Включить');
  view.unmount();
  act(() => vi.advanceTimersByTime(2000));
  expect(close).toHaveBeenCalledOnce();
});

it('запрет браузера объясняется, урок продолжается', async () => {
  vi.stubGlobal('AudioContext', undefined);
  renderApp(<LessonMusic projector={false} target={null} />);
  open();
  await click('Включить');
  expect(screen.getByRole('alert')).toHaveTextContent('Звук недоступен');
  expect(screen.getByRole('button', { name: 'Включить' })).toBeVisible();
});

it('недоступное хранилище не мешает', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  renderApp(<LessonMusic projector={false} target={null} />);
  open();
  await click('Включить');
  expect(screen.getByRole('status')).toHaveTextContent('Играет: Тихое утро');
});

it('в проекторе панель переносится на экран', () => {
  const target = document.createElement('div');
  document.body.append(target);
  renderApp(<LessonMusic projector target={target} />);
  expect(within(target).getByRole('button', { name: /^Музыка/ })).toBeVisible();
  target.remove();
});

it('в архивной группе музыки нет', () => {
  renderInGroup(<LessonPage />, groupData({ archivedAt: new Date().toISOString() }));
  expect(screen.queryByRole('region', { name: 'Музыка на уроке' })).not.toBeInTheDocument();
});
