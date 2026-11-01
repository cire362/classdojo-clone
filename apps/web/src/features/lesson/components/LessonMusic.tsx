import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MusicNotesIcon, PlayIcon, StopIcon, XIcon } from '@phosphor-icons/react';
import { useLessonMusic } from '../hooks/useLessonMusic';
import { TRACKS } from '../music';

/** Один проигрыватель остаётся смонтированным: в проекторе меняется только место панели, и музыка не прерывается. */
export function LessonMusic({ projector, target }: { projector: boolean; target: HTMLElement | null }) {
  const music = useLessonMusic();
  const { settings, playing, error } = music;
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const focusToggle = useRef(false);
  const focusPanel = useRef(false);
  const id = useId();
  const track = TRACKS.find((t) => t.id === settings.trackId)!;

  useEffect(() => {
    if (!open && focusToggle.current) { toggle.current?.focus(); focusToggle.current = false; }
    if (open && focusPanel.current) { primary.current?.focus(); focusPanel.current = false; }
  }, [open]);

  const panel = (
    <section aria-label="Музыка на уроке" className={projector ? 'mb-6' : open ? 'w-full' : ''}>
      {!open ? (
        <button
          ref={toggle}
          className="btn btn-secondary btn-sm"
          aria-expanded={false}
          onClick={() => {
            focusPanel.current = true;
            setOpen(true);
          }}
        >
          <MusicNotesIcon size={20} aria-hidden /> Музыка{playing && <span>· {track.title}</span>}
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
              <MusicNotesIcon size={22} aria-hidden /> Музыка на уроке
            </h2>
            <button
              className="icon-btn -mr-2 -mt-2"
              aria-label="Скрыть музыку"
              onClick={() => {
                focusToggle.current = true;
                setOpen(false);
              }}
            >
              <XIcon size={20} aria-hidden />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div role="group" aria-label="Мелодия" className="flex flex-wrap gap-1 rounded-2xl bg-surface-2 p-1 sm:w-fit sm:rounded-full">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  className={`tab ${t.id === track.id ? 'active' : ''}`}
                  aria-pressed={t.id === track.id}
                  onClick={() => music.chooseTrack(t.id)}
                >
                  {t.title}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button ref={primary} className="btn btn-primary" onClick={playing ? music.stop : music.play}>
                {playing ? <StopIcon size={20} weight="fill" aria-hidden /> : <PlayIcon size={18} weight="fill" aria-hidden />}
                {playing ? 'Остановить' : 'Включить'}
              </button>
              <div className="min-w-48 flex-1 sm:max-w-xs">
                <label className="label" htmlFor={`${id}-volume`}>Громкость: {settings.volume}%</label>
                <input
                  id={`${id}-volume`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="h-11 w-full cursor-pointer accent-ink"
                  value={settings.volume}
                  onChange={(e) => music.changeVolume(Number(e.target.value))}
                />
              </div>
            </div>
            <p role="status" className="text-sm font-semibold">{playing ? `Играет: ${track.title}` : 'Музыка выключена'}</p>
            {error && <p role="alert" className="text-sm text-minus">{error}</p>}
            <p className="text-sm text-ink-soft">Мелодии создаются прямо в браузере. Музыка играет, пока открыт экран урока.</p>
          </div>
        </div>
      )}
    </section>
  );

  if (projector) return target ? createPortal(panel, target) : null;
  return panel;
}
