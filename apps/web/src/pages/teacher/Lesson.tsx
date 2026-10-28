import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckIcon,
  DiceFiveIcon,
  ProjectorScreenIcon,
  SelectionAllIcon,
  StarIcon,
  UserPlusIcon,
  UsersThreeIcon,
  XIcon,
} from '@phosphor-icons/react';
import { api, type CardSummary, type LessonStudent, type Reason } from '../../api';
import { HeroAvatar, heroTint } from '../../components/HeroAvatar';
import { useToast } from '../../components/Toast';
import { EmptyState, Modal } from '../../components/ui';
import { pluralize } from '../../hooks';
import { useGroup } from './GroupLayout';

interface Burst {
  key: number;
  value: number;
}

export function LessonPage() {
  const { data, setData } = useGroup();
  const toast = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [projector, setProjector] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [bursts, setBursts] = useState<Record<string, Burst>>({});
  const burstKey = useRef(1);

  const students = data.students;
  const present = data.todayAttendance ? new Set(data.todayAttendance.presentStudentIds) : null;

  const applySummaries = useCallback(
    (summaries: Record<string, CardSummary>) => {
      setData({
        ...data,
        students: data.students.map((s) => (summaries[s.id] ? { ...s, ...summaries[s.id] } : s)),
      });
    },
    [data, setData],
  );

  async function award(reason: Reason) {
    if (!target) return;
    const ids = target.ids;
    setTarget(null);
    try {
      const res = await api<{ value: number; eventIds: string[]; summaries: Record<string, CardSummary> }>(
        'POST',
        `/teacher/groups/${data.group.id}/points`,
        { studentIds: ids, reasonId: reason.id },
      );
      applySummaries(res.summaries);
      setSelected(new Set());
      setSelectMode(false);
      if (reason.value > 0) {
        const next: Record<string, Burst> = {};
        for (const id of ids) next[id] = { key: burstKey.current++, value: reason.value };
        setBursts((b) => ({ ...b, ...next }));
      }
      // На общем экране минусы не показываем: для списаний — нейтральное «Записано»
      const undo = {
        label: 'Отменить',
        run: async () => {
          const r = await api<{ summaries: Record<string, CardSummary> }>('POST', '/teacher/points/undo', {
            eventIds: res.eventIds,
          });
          applySummaries(r.summaries);
          toast({ text: 'Отменено', tone: 'neutral' });
        },
      };
      const who = ids.length === 1 ? students.find((s) => s.id === ids[0])?.name.split(' ')[0] : `${ids.length} ${pluralize(ids.length, 'ученик', 'ученика', 'учеников')}`;
      toast(
        reason.value > 0
          ? { text: `${who}: +${reason.value}, ${reason.name.toLowerCase()}`, tone: 'ok', action: undo }
          : { text: 'Записано', tone: 'neutral', action: undo },
      );
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  function onCardClick(s: LessonStudent) {
    if (selectMode) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(s.id)) next.delete(s.id);
        else next.add(s.id);
        return next;
      });
    } else {
      setTarget({ ids: [s.id], label: s.name });
    }
  }

  // Режим проектора: полноэкранный, Esc — выход
  useEffect(() => {
    if (!projector) return;
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProjector(false);
    const onFs = () => !document.fullscreenElement && setProjector(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [projector]);

  if (!students.length) {
    return (
      <EmptyState icon={<UserPlusIcon size={28} />} title="В группе пока нет учеников">
        <p>Добавьте учеников списком, и у каждого появится свой герой.</p>
        <Link to="students" className="btn btn-primary mt-4">
          Добавить учеников
        </Link>
      </EmptyState>
    );
  }

  const grid = (
    <div
      className={
        projector
          ? 'grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5'
          : 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:gap-4'
      }
    >
      {students.map((s) => (
        <StudentCard
          key={s.id}
          student={s}
          big={projector}
          absent={present ? !present.has(s.id) : false}
          selectable={selectMode}
          selected={selected.has(s.id)}
          burst={bursts[s.id]}
          onClick={onCardClick}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {selectMode ? (
          <>
            <button className="btn btn-secondary" onClick={() => setSelected(new Set(students.map((s) => s.id)))}>
              <SelectionAllIcon size={20} /> Выбрать всех
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSelectMode(false);
                setSelected(new Set());
              }}
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => setTarget({ ids: students.map((s) => s.id), label: 'Вся группа' })}>
              <UsersThreeIcon size={20} weight="bold" /> Всей группе
            </button>
            <button className="btn btn-secondary" onClick={() => setSelectMode(true)}>
              <CheckIcon size={20} /> Несколько
            </button>
            <button className="btn btn-secondary" onClick={() => setRandomOpen(true)}>
              <DiceFiveIcon size={20} /> Случайный
            </button>
            <button className="btn btn-secondary ml-auto hidden sm:inline-flex" onClick={() => setProjector(true)}>
              <ProjectorScreenIcon size={20} /> Проектор
            </button>
          </>
        )}
      </div>

      {grid}

      {/* Панель выбора нескольких учеников */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
              <span className="font-semibold tabular-nums">
                Выбрано: {selected.size}
              </span>
              <button
                className="btn btn-primary"
                disabled={!selected.size}
                onClick={() =>
                  setTarget({
                    ids: [...selected],
                    label: `${selected.size} ${pluralize(selected.size, 'ученик', 'ученика', 'учеников')}`,
                  })
                }
              >
                Начислить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {selectMode && <div className="h-20" />}

      {/* Режим проектора */}
      {projector && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-bg px-8 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-4xl">{data.group.name}</h1>
            <div className="flex gap-2 opacity-60 transition hover:opacity-100">
              <button className="icon-btn" onClick={() => setRandomOpen(true)} aria-label="Случайный ученик">
                <DiceFiveIcon size={26} />
              </button>
              <button className="icon-btn" onClick={() => setProjector(false)} aria-label="Выйти из режима проектора">
                <XIcon size={26} />
              </button>
            </div>
          </div>
          {grid}
        </div>
      )}

      <ReasonPicker
        open={!!target}
        label={target?.label ?? ''}
        reasons={data.reasons}
        onPick={award}
        onClose={() => setTarget(null)}
        groupId={data.group.id}
      />

      <RandomPicker
        open={randomOpen}
        students={present && present.size ? students.filter((s) => present.has(s.id)) : students}
        onlyPresent={!!present && present.size > 0}
        onClose={() => setRandomOpen(false)}
        onAward={(s) => {
          setRandomOpen(false);
          setTarget({ ids: [s.id], label: s.name });
        }}
      />
    </>
  );
}

const StudentCard = memo(function StudentCard({
  student: s,
  big,
  absent,
  selectable,
  selected,
  burst,
  onClick,
}: {
  student: LessonStudent;
  big: boolean;
  absent: boolean;
  selectable: boolean;
  selected: boolean;
  burst?: Burst;
  onClick: (s: LessonStudent) => void;
}) {
  return (
    <motion.button
      type="button"
      layout="position"
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(s)}
      aria-pressed={selectable ? selected : undefined}
      aria-label={`${s.name}, всего ${s.totalEarned}`}
      className={`card relative flex flex-col items-stretch overflow-hidden p-2.5 text-left transition-[box-shadow,opacity] hover:shadow-[var(--shadow-pop)] ${
        selected ? 'ring-4 ring-accent' : ''
      } ${absent ? 'opacity-55' : ''}`}
    >
      <div className="relative rounded-xl" style={{ background: heroTint(s.hero.parts) }}>
        <HeroAvatar parts={s.hero.parts} className="mx-auto aspect-[5/6] w-[88%]" />
        {s.todayEarned > 0 && (
          <span className={`chip absolute right-2 top-2 bg-plus-bg text-plus ${big ? 'text-lg' : ''}`}>+{s.todayEarned}</span>
        )}
        {selectable && (
          <span
            className={`absolute left-2 top-2 flex size-7 items-center justify-center rounded-full border-2 ${
              selected ? 'border-ink bg-accent text-on-accent' : 'border-line bg-surface'
            }`}
            aria-hidden
          >
            {selected && <CheckIcon size={16} weight="bold" />}
          </span>
        )}
        {absent && !big && (
          <span className="chip absolute bottom-2 left-2 bg-surface text-xs text-ink-soft">нет на уроке</span>
        )}
        <AnimatePresence>
          {burst && (
            <motion.span
              key={burst.key}
              className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit rounded-full bg-accent px-3 py-1 font-display text-2xl text-on-accent shadow-[var(--shadow-pop)]"
              initial={{ opacity: 0, y: 10, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: -40, scale: 1 }}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            >
              +{burst.value}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className={`px-1 pb-0.5 pt-2.5 ${big ? 'pt-3' : ''}`}>
        <div className={`truncate font-semibold ${big ? 'text-xl' : ''}`}>{s.name}</div>
        <div className={`mt-0.5 flex items-center justify-between text-ink-soft ${big ? 'text-base' : 'text-sm'}`}>
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-ink">
            <StarIcon size={big ? 18 : 15} weight="fill" className="text-accent" />
            {s.totalEarned}
          </span>
          <span>ур. {s.level}</span>
        </div>
      </div>
    </motion.button>
  );
});

function ReasonPicker({
  open,
  label,
  reasons,
  onPick,
  onClose,
  groupId,
}: {
  open: boolean;
  label: string;
  reasons: Reason[];
  onPick: (r: Reason) => void;
  onClose: () => void;
  groupId: string;
}) {
  const plus = reasons.filter((r) => r.value > 0);
  const minus = reasons.filter((r) => r.value < 0);
  const tile = (r: Reason) => (
    <button
      key={r.id}
      onClick={() => onPick(r)}
      className="flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-ink active:scale-[0.97]"
    >
      <span className="text-3xl leading-none" aria-hidden>
        {r.emoji}
      </span>
      <span className="flex w-full items-end justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{r.name}</span>
        <span className={`chip shrink-0 ${r.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>
          {r.value > 0 ? `+${r.value}` : `−${Math.abs(r.value)}`}
        </span>
      </span>
    </button>
  );
  return (
    <Modal open={open} title={label} onClose={onClose} size="lg">
      {reasons.length === 0 ? (
        <p className="text-ink-soft">
          Причин нет. <Link to={`/g/${groupId}/reasons`} className="font-semibold text-ink underline">Добавьте их</Link>.
        </p>
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink-soft">Молодец</h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{plus.map(tile)}</div>
          </section>
          {minus.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink-soft">Нужно поработать</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{minus.map(tile)}</div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function RandomPicker({
  open,
  students,
  onlyPresent,
  onClose,
  onAward,
}: {
  open: boolean;
  students: LessonStudent[];
  onlyPresent: boolean;
  onClose: () => void;
  onAward: (s: LessonStudent) => void;
}) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);
  const order = useMemo(() => students.map((_, i) => i).sort(() => Math.random() - 0.5), [students, run]);

  useEffect(() => {
    if (!open || !students.length) return;
    setDone(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 1 : 14 + Math.floor(Math.random() * 6);
    const timers: number[] = [];
    let t = 0;
    for (let i = 0; i < steps; i++) {
      t += 60 + i * i * 2.2; // замедление к концу
      timers.push(window.setTimeout(() => setIndex(order[i % order.length]), t));
    }
    timers.push(window.setTimeout(() => setDone(true), t + 80));
    return () => timers.forEach(clearTimeout);
  }, [open, run, order, students.length]);

  const s = students[index];
  return (
    <Modal open={open} title={onlyPresent ? 'Случайный из присутствующих' : 'Случайный ученик'} onClose={onClose}>
      {s && (
        <div className="flex flex-col items-center text-center">
          <motion.div
            key={done ? 'done' : s.id}
            initial={done ? { scale: 0.85 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className={`w-48 rounded-2xl p-2 transition-colors ${done ? 'bg-accent/30' : 'bg-surface-2'}`}
          >
            <HeroAvatar parts={s.hero.parts} className="aspect-[5/6]" />
          </motion.div>
          <p className={`mt-4 font-display text-2xl transition-opacity ${done ? '' : 'opacity-60'}`}>{s.name}</p>
          <div className={`mt-6 flex flex-wrap justify-center gap-2 transition-opacity ${done ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <button className="btn btn-primary" onClick={() => onAward(s)}>
              Начислить баллы
            </button>
            <button className="btn btn-secondary" onClick={() => setRun((r) => r + 1)}>
              <DiceFiveIcon size={20} /> Ещё раз
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
