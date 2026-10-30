import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MicrophoneIcon, MicrophoneSlashIcon, WaveformIcon, XIcon } from '@phosphor-icons/react';
import { useNoiseMeter } from '../lib/useNoiseMeter';
import { noiseBand } from '../lib/noise-meter';

/** Контроллер остаётся на месте при переходе в проектор, переносится только панель. */
export function LessonNoiseMeter({ groupId, projector, target }: { groupId: string; projector: boolean; target: HTMLElement | null }) {
  const control = useNoiseMeter(groupId);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const focusToggle = useRef(false);
  const id = useId();
  const active = control.phase === 'active';
  const starting = control.phase === 'starting';
  const band = noiseBand(control.level, control.threshold);
  const label = active ? band === 'loud' ? 'Давайте потише' : band === 'near' ? 'Близко к порогу' : 'В пределах порога' : starting ? 'Ожидаем доступ к микрофону' : 'Микрофон выключен';
  const color = !active ? 'bg-line' : band === 'loud' ? 'bg-minus' : band === 'near' ? 'bg-accent' : 'bg-plus';
  const [announcement, setAnnouncement] = useState(label);
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncement(label), active ? 700 : 0);
    return () => window.clearTimeout(timer);
  }, [label, active]);
  useEffect(() => { if (!open && focusToggle.current) { toggle.current?.focus(); focusToggle.current = false; } }, [open]);

  const panel = <section aria-label="Шумомер урока" className={projector ? 'mb-6' : ''}>
    {!open ? <button ref={toggle} className="btn btn-secondary btn-sm" aria-expanded={false} onClick={() => setOpen(true)}><WaveformIcon size={20} aria-hidden /> Шумомер</button> : (
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-sans text-base font-semibold"><WaveformIcon size={22} aria-hidden /> Шумомер</h2>
          <button className="icon-btn -mr-2 -mt-2" aria-label="Скрыть шумомер" onClick={() => { control.stop(); focusToggle.current = true; setOpen(false); }}><XIcon size={20} aria-hidden /></button>
        </div>
        <p className="sr-only" role="status">{announcement}</p>
        <div className={`mt-3 space-y-4 ${projector ? 'mx-auto max-w-4xl' : ''}`}>
          <div className="flex flex-wrap items-end justify-between gap-2" aria-live="off">
            <p className={`font-semibold ${projector ? 'text-3xl sm:text-5xl' : 'text-lg'}`}>{label}</p>
            <span className={`tabular-nums text-ink-soft ${projector ? 'text-2xl' : 'text-sm'}`}>{active ? `${control.level} / 100` : '— / 100'}</span>
          </div>
          <div role="meter" aria-label="Громкость" aria-valuemin={0} aria-valuemax={100} aria-valuenow={active ? control.level : 0} aria-valuetext={active ? `${control.level} из 100. ${label}. Порог ${control.threshold}` : label} className={`relative overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ${projector ? 'h-16' : 'h-8'}`}>
            <div className={`h-full transition-[width,background-color] duration-150 motion-reduce:transition-none ${color}`} style={{ width: active ? `${control.level}%` : '0%' }} />
            <span aria-hidden className="absolute inset-y-0 w-1 -translate-x-1/2 bg-ink ring-1 ring-surface" style={{ left: `${control.threshold}%` }} />
          </div>
          <div className={`flex flex-wrap items-end gap-4 ${projector ? 'sm:gap-8' : ''}`}>
            <div className="min-w-0 flex-1 basis-52">
              <label className="label" htmlFor={`${id}-threshold`}>Порог для группы: <span className="tabular-nums">{control.threshold}</span></label>
              <input id={`${id}-threshold`} type="range" min={10} max={90} step={1} value={control.threshold} aria-describedby={`${id}-threshold-hint`} className="h-11 w-full cursor-pointer accent-ink" onChange={(e) => control.changeThreshold(Number(e.target.value))} />
              <p id={`${id}-threshold-hint`} className="text-xs text-ink-soft">Ниже — строже, выше — можно громче. Запоминается для этой группы в этом браузере.</p>
            </div>
            <button className="btn btn-primary" disabled={starting} onClick={() => { if (active) control.stop(); else void control.start(); }}>
              {active ? <MicrophoneSlashIcon size={20} aria-hidden /> : <MicrophoneIcon size={20} aria-hidden />}
              {active ? 'Выключить микрофон' : starting ? 'Запрашиваем доступ…' : 'Включить микрофон'}
            </button>
            {starting && <button className="btn btn-secondary" onClick={() => control.stop()}>Отменить запрос</button>}
          </div>
          {control.message && <p role={control.phase === 'error' ? 'alert' : 'status'} className={`text-sm ${control.phase === 'error' ? 'text-minus' : 'text-ink-soft'}`}>{control.message}</p>}
          <p className="text-sm text-ink-soft">Измеряется только громкость. Звук не записывается и не отправляется. Шкала относительная, не децибелы: показания зависят от микрофона.</p>
        </div>
      </div>
    )}
  </section>;
  return projector ? target ? createPortal(panel, target) : null : panel;
}
