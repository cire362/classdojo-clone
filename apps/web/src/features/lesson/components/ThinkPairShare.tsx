import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowCounterClockwiseIcon, ArrowRightIcon, ChatsCircleIcon, PauseIcon, PlayIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { formatTimer } from '../lesson-timer';
import { useThinkPairShare } from '../hooks/useThinkPairShare';
import { useTimerSound } from '../hooks/useTimerSound';
import { LAST_STAGE, MAX_STAGE_MINUTES, STAGES, stageMinutes } from '../think-pair-share';
import { Switch } from '../../../ui';

const TITLE = 'Подумай — обсуди — поделись';

/** Таймер этапов: как и обычный таймер, в проекторе переносится на экран, не теряя отсчёта. */
export function ThinkPairShare({ groupId, projector, target }: { groupId: string; projector: boolean; target: HTMLElement | null }) {
  const tps = useThinkPairShare(groupId);
  const { timer, remaining, stage, active } = tps;
  const { sound, soundError, enableSound, disableSound } = useTimerSound(timer.status);
  const [open, setOpen] = useState(active);
  const [fields, setFields] = useState(tps.minutes.map(String));
  const toggle = useRef<HTMLButtonElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const focusCommand = useRef(false);
  const focusToggle = useRef(false);
  const id = useId();
  const expanded = open || (projector && active);
  const minutes = stageMinutes(fields);
  const finished = timer.status === 'finished';
  const current = STAGES[stage];
  const following = stage < LAST_STAGE ? STAGES[stage + 1] : null;

  useEffect(() => {
    if (!expanded && focusToggle.current) { toggle.current?.focus(); focusToggle.current = false; }
    if (expanded && focusCommand.current) { primary.current?.focus(); focusCommand.current = false; }
  }, [expanded, active, stage]);

  /** Команда меняет панель, поэтому фокус переводим на главную кнопку */
  function command(run: () => void) {
    focusCommand.current = true;
    if (sound) void enableSound();
    run();
  }
  function start(e: FormEvent) {
    e.preventDefault();
    if (minutes) command(() => tps.start(minutes));
  }
  function primaryAction() {
    if (finished) command(tps.extend);
    else if (timer.status === 'running') command(tps.pause);
    else command(tps.resume);
  }
  const statusWord = finished ? 'Время вышло!' : timer.status === 'paused' ? 'На паузе' : 'Идёт отсчёт';

  const setup = (
    <form onSubmit={start} noValidate className="mt-4 space-y-3">
      <div className={`flex flex-wrap items-end gap-3 ${projector ? 'justify-center' : ''}`}>
        {STAGES.map((s, i) => (
          <label key={s.title} className="grid gap-1 text-sm font-medium" htmlFor={`${id}-${i}`}>
            {s.title}, мин
            <input
              id={`${id}-${i}`}
              aria-describedby={`${id}-range`}
              className="input w-20 text-center tabular-nums"
              inputMode="numeric"
              maxLength={2}
              value={fields[i]}
              onChange={(e) => {
                if (/^\d{0,2}$/.test(e.target.value)) setFields(fields.map((f, k) => (k === i ? e.target.value : f)));
              }}
            />
          </label>
        ))}
        <button ref={primary} className="btn btn-primary" disabled={!minutes}>
          <PlayIcon size={18} weight="fill" aria-hidden /> Начать
        </button>
      </div>
      <p id={`${id}-range`} className={`text-xs ${minutes ? 'text-ink-soft' : 'text-minus'}`}>
        Целое число минут на этап, от 1 до {MAX_STAGE_MINUTES}.
      </p>
    </form>
  );

  const running = (
    <div className={`mt-4 grid gap-4 ${projector ? 'justify-items-center text-center' : ''}`}>
      <ol aria-label="Этапы" className={`flex flex-wrap gap-2 ${projector ? 'justify-center' : ''}`}>
        {STAGES.map((s, i) => (
          <li
            key={s.title}
            aria-current={i === stage ? 'step' : undefined}
            className={`chip ${i === stage ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-soft'} ${projector ? 'text-xl' : ''}`}
          >
            {i + 1}. {s.title}
          </li>
        ))}
      </ol>
      <div>
        <p className={`font-display leading-tight ${projector ? 'text-[clamp(2.5rem,6vw,5rem)]' : 'text-2xl'}`}>{current.title}</p>
        <p className={`text-ink-soft ${projector ? 'text-2xl' : 'text-sm'}`}>{current.hint}</p>
      </div>
      <div>
        <p
          role="timer"
          aria-label="Осталось на этапе"
          aria-live="off"
          className={`font-display leading-none tabular-nums ${projector ? 'text-[clamp(4rem,12vw,9rem)]' : 'text-5xl'}`}
        >
          {formatTimer(remaining)}
        </p>
        <p role="status" className={`mt-2 font-semibold ${projector ? 'text-2xl' : 'text-sm'} ${finished ? 'text-ink' : 'text-ink-soft'}`}>
          <span className="sr-only">Этап {stage + 1} из {STAGES.length}: {current.title}. </span>
          {statusWord}
        </p>
      </div>
      <div className={`flex flex-wrap gap-2 ${projector ? 'justify-center' : ''}`}>
        {/* Кнопка остаётся тем же DOM-узлом при окончании этапа: клавиатурный фокус не теряется. */}
        <button ref={primary} type="button" className="btn btn-primary" onClick={primaryAction}>
          {finished && <PlusIcon size={20} aria-hidden />}
          {timer.status === 'running' && <PauseIcon size={20} weight="fill" aria-hidden />}
          {timer.status === 'paused' && <PlayIcon size={18} weight="fill" aria-hidden />}
          {finished ? 'Ещё минута' : timer.status === 'running' ? 'Пауза' : 'Продолжить'}
        </button>
        {following && (
          <button type="button" className="btn btn-secondary" onClick={() => command(tps.next)}>
            <ArrowRightIcon size={20} aria-hidden /> Дальше: {following.title}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => command(tps.reset)}>
          <ArrowCounterClockwiseIcon size={20} aria-hidden /> Завершить
        </button>
      </div>
    </div>
  );

  const panel = (
    <section aria-label={TITLE} className={projector ? 'mb-6' : expanded ? 'w-full' : ''}>
      {!expanded ? (
        <button
          ref={toggle}
          className="btn btn-secondary btn-sm"
          aria-expanded={false}
          onClick={() => {
            focusCommand.current = true;
            setOpen(true);
          }}
        >
          <ChatsCircleIcon size={20} aria-hidden /> {TITLE}
          {active && <span className="tabular-nums">· {current.title} {finished ? 'закончен' : formatTimer(remaining)}</span>}
        </button>
      ) : (
        <div className={`rounded-2xl border p-4 sm:p-5 ${finished ? 'border-accent bg-accent/15' : 'border-line bg-surface'}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
              <ChatsCircleIcon size={22} aria-hidden /> {TITLE}
            </h2>
            {(!projector || !active) && (
              <button className="icon-btn -mr-2 -mt-2" aria-label="Скрыть этапы" onClick={() => { focusToggle.current = true; setOpen(false); }}>
                <XIcon size={20} aria-hidden />
              </button>
            )}
          </div>
          {active ? running : setup}
          <label className={`mt-3 flex cursor-pointer items-center gap-2 ${projector ? 'justify-center' : ''}`}>
            <Switch checked={sound} onChange={(on) => { if (on) void enableSound(); else disableSound(); }} label="Звук в конце этапа" />
            <span className="text-sm text-ink-soft">Звук в конце этапа</span>
          </label>
          {soundError && <p role="status" className="mt-2 text-sm text-ink-soft">{soundError}</p>}
        </div>
      )}
    </section>
  );

  if (projector) return target ? createPortal(panel, target) : null;
  return panel;
}
