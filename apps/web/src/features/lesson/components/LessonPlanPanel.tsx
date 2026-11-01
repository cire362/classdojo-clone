import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ListNumbersIcon, PencilSimpleIcon, XIcon } from '@phosphor-icons/react';
import { useGroup } from '../../groups';
import type { LessonPlan } from '../../../lib/api';
import { useToast } from '../../../ui/Toast';
import { savePlan, setPlanStep } from '../api';

const MAX_STEPS = 20;
const MAX_STEP_LENGTH = 200;

const parseSteps = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

/** Что делаем сейчас и что дальше. План хранится на сервере: его можно написать дома и показать в классе. */
export function LessonPlanPanel({ projector, target }: { projector: boolean; target: HTMLElement | null }) {
  const { data, setData } = useGroup();
  const toast = useToast();
  const { steps, current } = data.plan;
  const [open, setOpen] = useState(false);
  const [hiddenOnProjector, setHiddenOnProjector] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const focusToggle = useRef(false);
  const focusPanel = useRef(false);
  const nextButton = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const hasPlan = steps.length > 0;
  const expanded = open || (projector && hasPlan && !hiddenOnProjector);
  const showEditor = !projector && (editing || !hasPlan);
  const parsed = parseSteps(draft);
  const tooMany = parsed.length > MAX_STEPS;
  const tooLong = parsed.some((step) => step.length > MAX_STEP_LENGTH);

  useEffect(() => {
    if (!expanded && focusToggle.current) { toggle.current?.focus(); focusToggle.current = false; }
    if (expanded && focusPanel.current) { (nextButton.current ?? textarea.current)?.focus(); focusPanel.current = false; }
  }, [expanded, showEditor]);

  async function run(request: () => Promise<LessonPlan>) {
    if (busy) return false;
    setBusy(true);
    try {
      const plan = await request();
      setData((group) => group && { ...group, plan });
      return true;
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }
  function go(step: number) {
    if (step >= 0 && step < steps.length && step !== current) void run(() => setPlanStep(data.group.id, step));
  }
  function edit() {
    setDraft(steps.join('\n'));
    setEditing(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (await run(() => savePlan(data.group.id, parsed))) closeEditor();
  }
  async function clear() {
    if (await run(() => savePlan(data.group.id, []))) {
      setDraft('');
      closeEditor();
    }
  }
  function closeEditor() {
    focusPanel.current = true;
    setEditing(false);
  }
  function hide() {
    focusToggle.current = true;
    setOpen(false);
    setEditing(false);
    if (projector) setHiddenOnProjector(true);
  }

  const editor = (
    <form onSubmit={save} className="mt-4 space-y-3">
      <div>
        <label className="label" htmlFor={`${id}-steps`}>Шаги урока, по одному на строку</label>
        <textarea
          id={`${id}-steps`}
          className="input min-h-40 resize-y leading-relaxed"
          aria-describedby={`${id}-limits`}
          placeholder={'Разминка\nНовая тема\nРабота в парах\nИтоги'}
          ref={textarea}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
        />
        <p id={`${id}-limits`} className={`mt-1 text-xs ${tooMany || tooLong ? 'text-minus' : 'text-ink-soft'}`}>
          До {MAX_STEPS} шагов, в каждом до {MAX_STEP_LENGTH} символов.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy || !parsed.length || tooMany || tooLong}>Сохранить</button>
        {hasPlan && <button type="button" className="btn btn-secondary" onClick={closeEditor}>Отмена</button>}
        {hasPlan && <button type="button" className="btn btn-ghost" disabled={busy} onClick={clear}>Очистить план</button>}
      </div>
    </form>
  );

  const atStart = current === 0;
  const atEnd = current === steps.length - 1;
  const view = (
    <div className={`mt-4 space-y-4 ${projector ? 'text-center' : ''}`}>
      <div>
        <p role="status" className={`font-semibold text-ink-soft ${projector ? 'text-2xl' : 'text-sm'}`}>
          Сейчас, шаг {current + 1} из {steps.length}
        </p>
        <p className={`break-words font-display leading-tight ${projector ? 'text-[clamp(2.5rem,6vw,5rem)]' : 'text-2xl'}`}>
          {steps[current]}
        </p>
        {!atEnd && <p className={`mt-1 break-words text-ink-soft ${projector ? 'text-2xl' : 'text-sm'}`}>Дальше: {steps[current + 1]}</p>}
      </div>
      <div className={`flex flex-wrap gap-2 ${projector ? 'justify-center' : ''}`}>
        {/* На краях плана кнопки не отключаются: иначе клавиатурный фокус терялся бы на последнем шаге */}
        <button
          ref={nextButton}
          className={`btn btn-primary ${atEnd ? 'opacity-50' : ''}`}
          aria-disabled={atEnd}
          onClick={() => go(current + 1)}
        >
          <ArrowRightIcon size={20} aria-hidden /> Следующий шаг
        </button>
        <button className={`btn btn-secondary ${atStart ? 'opacity-50' : ''}`} aria-disabled={atStart} onClick={() => go(current - 1)}>
          <ArrowLeftIcon size={20} aria-hidden /> Назад
        </button>
        {!projector && <button className="btn btn-ghost" onClick={edit}><PencilSimpleIcon size={20} aria-hidden /> Изменить</button>}
      </div>
      <ol aria-label="Порядок шагов" className={`grid gap-1 text-left ${projector ? 'mx-auto max-w-3xl text-xl' : 'text-sm'}`}>
        {steps.map((step, i) => (
          <li key={i}>
            <button
              className={[
                'flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-surface-2',
                i === current ? 'bg-accent/25 font-semibold' : '',
                i < current ? 'text-ink-soft' : '',
              ].join(' ')}
              aria-current={i === current ? 'step' : undefined}
              onClick={() => go(i)}
            >
              <span className="w-6 shrink-0 tabular-nums">
                {i < current ? <CheckIcon size={18} className="mt-0.5" aria-label="Пройдено" /> : `${i + 1}.`}
              </span>
              <span className="min-w-0 break-words">{step}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );

  const panel = (
    <section aria-label="План урока" className={projector ? 'mb-6' : expanded ? 'w-full' : ''}>
      {!expanded ? (
        <button
          ref={toggle}
          className="btn btn-secondary btn-sm"
          aria-expanded={false}
          onClick={() => {
            focusPanel.current = true;
            setOpen(true);
            setHiddenOnProjector(false);
          }}
        >
          <ListNumbersIcon size={20} aria-hidden /> План урока
          {hasPlan && <span className="tabular-nums">· {current + 1} из {steps.length}</span>}
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
              <ListNumbersIcon size={22} aria-hidden /> План урока
            </h2>
            <button className="icon-btn -mr-2 -mt-2" aria-label="Скрыть план урока" onClick={hide}><XIcon size={20} aria-hidden /></button>
          </div>
          {showEditor ? editor : view}
        </div>
      )}
    </section>
  );

  // Пустой план на проекторе показывать нечего, а редактировать его там неудобно
  if (projector) return target && hasPlan ? createPortal(panel, target) : null;
  return panel;
}
