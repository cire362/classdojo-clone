import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LessonNoiseMeter } from '../src/components/LessonNoiseMeter';
import { LessonPage } from '../src/pages/teacher/Lesson';
import { microphoneError, NOISE_THRESHOLD_KEY, noiseBand, restoreNoiseThreshold, sampleNoiseLevel } from '../src/lib/noise-meter';
import { renderApp } from './render';
import { groupData, renderInGroup } from './group-harness';

class Track extends EventTarget {
  readyState = 'live'; muted = false;
  stop = vi.fn(() => { this.readyState = 'ended'; });
}
const contexts: Context[] = [];
let amplitude = 0.01;
class Context extends EventTarget {
  state = 'suspended';
  destination = {};
  analyser = { fftSize: 2048, disconnect: vi.fn(), getFloatTimeDomainData: vi.fn((data: Float32Array) => { for (let i = 0; i < data.length; i++) data[i] = i % 2 ? amplitude : -amplitude; }) };
  source = { connect: vi.fn(), disconnect: vi.fn() };
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createAnalyser = () => this.analyser;
  createMediaStreamSource = vi.fn(() => this.source);
  constructor() { super(); contexts.push(this); }
}
let track: Track;
let stream: MediaStream;
let gum = vi.fn();
const mediaDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); contexts.length = 0; amplitude = 0.01;
  track = new Track(); stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  gum = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: gum } });
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('isSecureContext', true);
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear();
  if (mediaDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDescriptor);
  else Reflect.deleteProperty(navigator, 'mediaDevices');
});
const renderMeter = (groupId = 'g1') => renderApp(<LessonNoiseMeter key={groupId} groupId={groupId} projector={false} target={null} />);
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Шумомер' }));
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Включить микрофон' })); });
const tick = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });

it('относительная шкала: тишина, средний и предельный сигнал; пороги и плохие настройки', () => {
  expect(sampleNoiseLevel(new Float32Array(8))).toBe(0);
  expect(sampleNoiseLevel(new Float32Array([0.001, -0.001]))).toBeCloseTo(0, 3);
  expect(sampleNoiseLevel(new Float32Array([0.01, -0.01]))).toBeCloseTo(100 / 3, 3);
  expect(sampleNoiseLevel(new Float32Array([2, -2]))).toBe(100);
  expect(sampleNoiseLevel(new Float32Array([NaN]))).toBe(0);
  for (const raw of [null, '', 'NaN', '91', '9', '50.5']) expect(restoreNoiseThreshold(raw)).toBe(60);
  expect(restoreNoiseThreshold('35')).toBe(35);
  expect([noiseBand(49, 60), noiseBand(50, 60), noiseBand(60, 60)]).toEqual(['quiet', 'near', 'loud']);
});

it('микрофон включается только по нажатию; анализ не подключён к динамикам, стоп освобождает ресурсы', async () => {
  renderMeter(); expect(gum).not.toHaveBeenCalled(); open(); expect(gum).not.toHaveBeenCalled();
  await start(); tick();
  expect(gum).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
  expect(Number(screen.getByRole('meter').getAttribute('aria-valuenow'))).toBeGreaterThan(25);
  expect(contexts[0].source.connect).toHaveBeenCalledExactlyOnceWith(contexts[0].analyser);
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', expect.stringContaining('В пределах порога'));
  fireEvent.change(screen.getByRole('slider'), { target: { value: '10' } });
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', expect.stringContaining('Давайте потише'));
  fireEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }));
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
  expect(contexts[0].source.disconnect).toHaveBeenCalledTimes(1);
  const samples = contexts[0].analyser.getFloatTimeDomainData.mock.calls[0][0];
  expect(samples.every((n) => n === 0)).toBe(true);
  const calls = contexts[0].analyser.getFloatTimeDomainData.mock.calls.length;
  tick(); expect(contexts[0].analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(calls);
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Микрофон выключен');
});

it('отказ в доступе можно повторить, старое разрешение после отмены не включает микрофон', async () => {
  gum.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  renderMeter(); open(); await start();
  expect(screen.getByRole('alert')).toHaveTextContent('Разрешите его в настройках сайта');
  let resolveOld!: (stream: MediaStream) => void;
  gum.mockImplementationOnce(() => new Promise<MediaStream>((resolve) => { resolveOld = resolve; }));
  await start(); fireEvent.click(screen.getByRole('button', { name: 'Отменить запрос' }));
  const oldTrack = new Track();
  await start();
  await act(async () => resolveOld({ getTracks: () => [oldTrack] } as unknown as MediaStream));
  expect(oldTrack.stop).toHaveBeenCalledOnce();
  expect(track.stop).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Выключить микрофон' })).toBeEnabled();
});

it('долгий запрос доступа объясняется, но не прерывается: окно разрешения может быть открыто', async () => {
  let allow!: (stream: MediaStream) => void;
  gum.mockImplementationOnce(() => new Promise<MediaStream>((resolve) => { allow = resolve; }));
  renderMeter(); open(); await start();
  tick(9_000);
  expect(screen.queryByText(/Браузер пока не дал доступ/)).not.toBeInTheDocument();
  tick(1_000);
  expect(screen.getByText(/Браузер пока не дал доступ/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Отменить запрос' })).toBeEnabled();

  await act(async () => allow(stream));
  expect(screen.getByRole('button', { name: 'Выключить микрофон' })).toBeEnabled();
  expect(screen.queryByText(/Браузер пока не дал доступ/)).not.toBeInTheDocument();
});

it('после отмены или быстрого ответа подсказка о долгом запросе не появляется', async () => {
  gum.mockImplementationOnce(() => new Promise<MediaStream>(() => undefined));
  renderMeter(); open(); await start();
  fireEvent.click(screen.getByRole('button', { name: 'Отменить запрос' }));
  tick(11_000);
  expect(screen.queryByText(/Браузер пока не дал доступ/)).not.toBeInTheDocument();

  await start();
  tick(11_000);
  expect(screen.getByRole('button', { name: 'Выключить микрофон' })).toBeEnabled();
  expect(screen.queryByText(/Браузер пока не дал доступ/)).not.toBeInTheDocument();
});

it('при скрытии вкладки микрофон выключается и сам не возобновляется', async () => {
  renderMeter(); open(); await start();
  const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(track.stop).toHaveBeenCalledOnce();
  expect(screen.getByText(/Измерение остановлено/)).toBeVisible();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(gum).toHaveBeenCalledOnce();
  if (original) Object.defineProperty(document, 'visibilityState', original); else Reflect.deleteProperty(document, 'visibilityState');
});

it('отключение устройства и приостановка звука убирают ложную зелёную шкалу', async () => {
  renderMeter(); open(); await start();
  act(() => track.dispatchEvent(new Event('ended')));
  expect(screen.getByRole('alert')).toHaveTextContent('доступ отозван');
  expect(contexts[0].close).toHaveBeenCalledOnce();
  track = new Track(); await start();
  act(() => { contexts[1].state = 'suspended'; contexts[1].dispatchEvent(new Event('statechange')); });
  expect(screen.getByRole('alert')).toHaveTextContent('Браузер приостановил');
  expect(track.stop).toHaveBeenCalledOnce();
});

it('сворачивание и уход со страницы освобождают микрофон, в том числе пока разрешение запаздывает', async () => {
  const view = renderMeter(); open(); await start();
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть шумомер' }));
  expect(track.stop).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Шумомер' })).toHaveFocus();
  open(); let resolveOld!: (stream: MediaStream) => void;
  gum.mockImplementationOnce(() => new Promise<MediaStream>((resolve) => { resolveOld = resolve; }));
  await start(); view.unmount();
  const late = new Track();
  await act(async () => resolveOld({ getTracks: () => [late] } as unknown as MediaStream));
  expect(late.stop).toHaveBeenCalledOnce();
});

it('порог отдельный для группы, не даёт разрешение после перезагрузки и работает без хранилища', () => {
  const first = renderMeter(); open(); fireEvent.change(screen.getByRole('slider'), { target: { value: '35' } });
  expect(localStorage.getItem(NOISE_THRESHOLD_KEY + 'g1')).toBe('35'); first.unmount();
  const second = renderMeter('g2'); open(); expect(screen.getByRole('slider')).toHaveValue('60'); second.unmount();
  const third = renderMeter(); open(); expect(screen.getByRole('slider')).toHaveValue('35'); expect(gum).not.toHaveBeenCalled(); third.unmount();
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error(); });
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error(); });
  renderMeter(); open(); fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
  expect(screen.getByRole('slider')).toHaveValue('45');
  read.mockRestore(); write.mockRestore();
});

it('незащищённый адрес и неподдерживаемый браузер объясняются без запроса доступа', async () => {
  vi.stubGlobal('isSecureContext', false); const view = renderMeter(); open(); await start();
  expect(screen.getByRole('alert')).toHaveTextContent('HTTPS или localhost'); expect(gum).not.toHaveBeenCalled(); view.unmount();
  vi.stubGlobal('isSecureContext', true); vi.stubGlobal('AudioContext', undefined); renderMeter(); open(); await start();
  expect(screen.getByRole('alert')).toHaveTextContent('не поддерживает шумомер'); expect(gum).not.toHaveBeenCalled();
  expect(microphoneError({ name: 'NotFoundError' })).toContain('не найден');
});

it('проектор использует тот же микрофон; архив скрывает инструмент, пустая группа его поддерживает', async () => {
  const first = renderInGroup(<LessonPage />, groupData()); open(); await start();
  fireEvent.click(screen.getByRole('button', { name: 'Проектор' })); tick();
  expect(screen.getByRole('button', { name: 'Выключить микрофон' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Выйти из режима проектора' }));
  expect(screen.getAllByRole('region', { name: 'Таймер урока' })).toHaveLength(1);
  expect(gum).toHaveBeenCalledOnce(); expect(track.stop).not.toHaveBeenCalled(); first.unmount();
  const archived = renderInGroup(<LessonPage />, groupData({ archivedAt: '2026-10-31' }));
  expect(screen.queryByRole('button', { name: 'Шумомер' })).not.toBeInTheDocument(); archived.unmount();
  renderInGroup(<LessonPage />, { ...groupData(), students: [] }); expect(screen.getByRole('button', { name: 'Шумомер' })).toBeVisible();
});
