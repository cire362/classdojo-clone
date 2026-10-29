import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowCounterClockwiseIcon, PauseIcon, PlayIcon, TimerIcon, XIcon } from '@phosphor-icons/react';
import { formatTimer, timerDuration } from '../lib/lesson-timer';
import { useLessonTimer } from '../lib/useLessonTimer';
import { Switch } from './ui';

const PRESETS = [1, 3, 5, 10];

/** Один контроллер остаётся смонтированным; в проекторе меняется только место его панели. */
export function LessonTimer({ groupId, projector, target }: { groupId: string; projector: boolean; target: HTMLElement | null }) {
  const control = useLessonTimer(groupId);
  const { timer, remaining } = control;
  const [open, setOpen] = useState(timer.status !== 'idle');
  const [minutes, setMinutes] = useState(String(Math.floor(timer.durationMs / 60_000)));
  const [seconds, setSeconds] = useState(String((timer.durationMs / 1000) % 60).padStart(2, '0'));
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const [soundError, setSoundError] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const soundRequest = useRef(0);
  const previousStatus = useRef(timer.status);
  const toggle = useRef<HTMLButtonElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const focusCommand = useRef(false);
  const focusToggle = useRef(false);
  const id = useId();
  const expanded = open || (projector && timer.status !== 'idle');
  const canConfigure = timer.status === 'idle' || timer.status === 'finished';
  const duration = timerDuration(minutes, seconds);

  async function enableSound() {
    const request = ++soundRequest.current;
    try {
      if (typeof AudioContext === 'undefined') throw new Error();
      const ctx = audio.current ??= new AudioContext();
      await ctx.resume();
      if (ctx.state !== 'running') throw new Error();
      if (request === soundRequest.current) { setSoundError(''); setSound(true); }
    } catch {
      if (request === soundRequest.current) { setSound(false); setSoundError('Звук недоступен. Таймер продолжает работать.'); }
    }
  }

  useEffect(() => () => { soundRequest.current++; void audio.current?.close().catch(() => undefined); }, []);
  useEffect(() => {
    if (timer.status === 'finished' && previousStatus.current === 'running' && sound) {
      try {
        const ctx = audio.current;
        if (!ctx || ctx.state !== 'running') throw new Error();
        // Два коротких негромких сигнала, без загружаемых звуковых файлов.
        for (let i = 0; i < 2; i++) {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const at = ctx.currentTime + i * 0.35;
          oscillator.type = 'sine';
          oscillator.frequency.value = i ? 880 : 660;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.linearRampToValueAtTime(0.08, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
          oscillator.connect(gain); gain.connect(ctx.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(at); oscillator.stop(at + 0.28);
        }
      } catch { setSound(false); setSoundError('Звук недоступен. Таймер продолжает работать.'); }
    }
    previousStatus.current = timer.status;
  }, [timer.status, sound]);
  useEffect(() => {
    if (!expanded && focusToggle.current) { toggle.current?.focus(); focusToggle.current = false; }
  }, [expanded]);
  useEffect(() => {
    if (expanded && focusCommand.current) { primary.current?.focus(); focusCommand.current = false; }
  }, [expanded, timer.status]);

  function preset(value: number) {
    setMinutes(String(value)); setSeconds('00'); setError('');
    control.configure(value * 60_000);
  }
  function start(e: FormEvent) {
    e.preventDefault();
    if (!canConfigure) return;
    if (!duration) { setError('Укажите время от 1 секунды до 99 минут 59 секунд.'); return; }
    setError('');
    focusCommand.current = true;
    if (sound) void enableSound();
    control.start(duration);
  }
  function reset() {
    focusCommand.current = true;
    setMinutes(String(Math.floor(timer.durationMs / 60_000)));
    setSeconds(String((timer.durationMs / 1000) % 60).padStart(2, '0'));
    setError(''); control.reset();
  }
  const status = timer.status === 'running' ? 'Идёт отсчёт' : timer.status === 'paused' ? 'На паузе' : timer.status === 'finished' ? 'Время вышло!' : 'Готов к запуску';

  const panel = <section aria-label="Таймер урока" className={projector ? 'mb-6' : ''}>
    {!expanded ? <button ref={toggle} className="btn btn-secondary btn-sm" aria-expanded={false} onClick={() => { focusCommand.current = true; setOpen(true); }}>
      <TimerIcon size={20} aria-hidden /> Таймер{timer.status !== 'idle' && <span className="tabular-nums">{timer.status === 'finished' ? '· Время вышло' : formatTimer(remaining)}</span>}
    </button> : <div id={id} className={`relative rounded-2xl border p-4 sm:p-5 ${timer.status === 'finished' ? 'border-accent bg-accent/15' : 'border-line bg-surface'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold"><TimerIcon size={22} aria-hidden /> Таймер</h2>
        {(!projector || timer.status === 'idle') && <button className="icon-btn -mr-2 -mt-2" aria-label="Скрыть таймер" onClick={() => { focusToggle.current = true; setOpen(false); }}><XIcon size={20} aria-hidden /></button>}
      </div>
      <div className={`mt-3 grid gap-4 ${projector ? 'justify-items-center text-center' : 'sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6'}`}>
        <div>
          <p role="timer" aria-label="Осталось времени" aria-live="off" className={`font-display leading-none tabular-nums ${projector ? 'text-[clamp(4rem,12vw,9rem)]' : 'text-5xl'}`}>{formatTimer(timer.status === 'idle' ? duration ?? timer.durationMs : remaining)}</p>
          <p role="status" className={`mt-2 font-semibold ${projector ? 'text-2xl' : 'text-sm'} ${timer.status === 'finished' ? 'text-ink' : 'text-ink-soft'}`}>{status}</p>
        </div>
        <div className={`min-w-0 space-y-3 ${projector ? 'w-full max-w-lg' : ''}`}>
          <form onSubmit={start} noValidate className="space-y-3">
            <div className={`flex flex-wrap items-end gap-2 ${projector ? 'justify-center' : ''}`}>
              {canConfigure && <>
              <label className="grid gap-1 text-sm font-medium" htmlFor={`${id}-minutes`}>Минуты<input id={`${id}-minutes`} aria-describedby={`${id}-range`} className="input w-20 text-center tabular-nums" inputMode="numeric" maxLength={2} value={minutes} onChange={(e) => { if (/^\d{0,2}$/.test(e.target.value)) setMinutes(e.target.value); }} /></label>
              <label className="grid gap-1 text-sm font-medium" htmlFor={`${id}-seconds`}>Секунды<input id={`${id}-seconds`} aria-describedby={`${id}-range`} className="input w-20 text-center tabular-nums" inputMode="numeric" maxLength={2} value={seconds} onChange={(e) => { if (/^\d{0,2}$/.test(e.target.value)) setSeconds(e.target.value); }} /></label>
              </>}
              {/* Кнопки остаются теми же DOM-узлами при окончании: клавиатурный фокус не теряется. */}
              <button key="primary" ref={primary} type={canConfigure ? 'submit' : 'button'} className="btn btn-primary" disabled={canConfigure && !duration} onClick={canConfigure ? undefined : () => {
                focusCommand.current = true;
                if (timer.status === 'running') control.pause();
                else { if (sound) void enableSound(); control.resume(); }
              }}>
                {timer.status === 'running' ? <PauseIcon size={20} weight="fill" aria-hidden /> : <PlayIcon size={18} weight="fill" aria-hidden />}
                {timer.status === 'running' ? 'Пауза' : timer.status === 'paused' ? 'Продолжить' : timer.status === 'finished' ? 'Начать снова' : 'Начать'}
              </button>
              {timer.status !== 'idle' && <button key="reset" type="button" className="btn btn-secondary" onClick={reset}><ArrowCounterClockwiseIcon size={20} aria-hidden />Сбросить</button>}
            </div>
            {canConfigure && <>
            <p id={`${id}-range`} className={`text-xs ${duration ? 'text-ink-soft' : 'text-minus'}`}>От 00:01 до 99:59. Секунды — от 0 до 59.</p>
            <div role="group" className={`flex flex-wrap gap-2 ${projector ? 'justify-center' : ''}`} aria-label="Быстрый выбор времени">
              {PRESETS.map((value) => <button key={value} type="button" className="btn btn-secondary btn-sm" onClick={() => preset(value)}>{value} мин</button>)}
            </div>
            {error && <p role="alert" className="text-sm text-minus">{error}</p>}
            </>}
          </form>
          <label className={`flex cursor-pointer items-center gap-2 ${projector ? 'justify-center' : ''}`}>
            <Switch checked={sound} onChange={(on) => { if (on) void enableSound(); else { soundRequest.current++; setSound(false); setSoundError(''); } }} label="Звук по окончании" />
            <span className="text-sm text-ink-soft">Звук по окончании</span>
          </label>
          {soundError && <p role="status" className="text-sm text-ink-soft">{soundError}</p>}
        </div>
      </div>
    </div>}
  </section>;

  if (projector) return target ? createPortal(panel, target) : null;
  return panel;
}
