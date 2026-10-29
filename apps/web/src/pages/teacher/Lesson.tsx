import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckIcon,
  DiceFiveIcon,
  FlagBannerIcon,
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
import { StudentSearch } from '../../components/StudentSearch';
import { matchesStudent } from '../../lib/student-search';
import { TeamsModal } from '../../components/TeamsModal';
import { EmptyState, Modal } from '../../components/ui';
import { pluralize } from '../../hooks';
import { usePresence } from '../../lib/presence';
import { useGroup } from './GroupLayout';

interface Burst {
  key: number;
  value: number;
  /** Если ученик перешёл на новый уровень — его номер */
  level?: number;
}

const TEAM_MODE_KEY = 'heroes:teams:';

function storedTeamMode(groupId: string): boolean {
  try {
    return localStorage.getItem(TEAM_MODE_KEY + groupId) === '1';
  } catch {
    return false;
  }
}

function rememberTeamMode(groupId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(TEAM_MODE_KEY + groupId, '1');
    else localStorage.removeItem(TEAM_MODE_KEY + groupId);
  } catch {
    // без запоминания
  }
}

export function LessonPage() {
  const { data, setData, reload } = useGroup();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const selectBar = usePresence(selectMode, 200);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [projector, setProjector] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [teamMode, setTeamMode] = useState(() => storedTeamMode(data.group.id));
  const [teamsOpen, setTeamsOpen] = useState(false);
  const teamView = teamMode && data.teams.length > 0;
  const [bursts, setBursts] = useState<Record<string, Burst>>({});
  const burstKey = useRef(1);

  const students = data.students;
  // Поиск скрывает карточки только на рабочем экране; проектор показывает всю группу.
  const searching = !projector && !!query.trim();
  const visibleStudents = searching ? students.filter((s) => matchesStudent(s, query)) : students;
  function search(value: string) {
    setQuery(value);
    setSelected(new Set());
  }
  const archived = !!data.group.archivedAt;
  const navigate = useNavigate();
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
      const before = new Map(students.map((s) => [s.id, s.level]));
      applySummaries(res.summaries);
      setSelected(new Set());
      setSelectMode(false);
      const leveled = ids.filter((id) => (res.summaries[id]?.level ?? 0) > (before.get(id) ?? 0));
      if (reason.value > 0) {
        const next: Record<string, Burst> = {};
        for (const id of ids) {
          const up = leveled.includes(id);
          next[id] = { key: burstKey.current++, value: reason.value, level: up ? res.summaries[id].level : undefined };
        }
        setBursts((b) => ({ ...b, ...next }));
      }
      if (leveled.length) {
        const names = leveled.map((id) => students.find((s) => s.id === id)?.name.split(' ')[0]).join(', ');
        toast({ text: `Новый уровень: ${names}!`, tone: 'ok' });
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
    // В архивной группе карточка открывает профиль ученика
    if (archived) {
      navigate(`/s/${s.id}`);
      return;
    }
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

  const gridClass = projector
    ? 'grid grid-cols-[repeat(auto-fill,minmax(clamp(220px,15vw,340px),1fr))] gap-5'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:gap-4';
  const card = (s: LessonStudent) => (
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
  );

  // Командный режим: карточки по командам, счёт команды — сумма баллов участников за сегодня
  const teamSections = teamView
    ? [
        ...data.teams.map((team) => ({ team, members: students.filter((s) => s.teamId === team.id) })),
        { team: null, members: students.filter((s) => !s.teamId || !data.teams.some((t) => t.id === s.teamId)) },
      ].filter((x) => x.team || x.members.length)
    : [];
  const scoreOf = (members: LessonStudent[]) => members.reduce((sum, s) => sum + s.todayEarned, 0);
  const best = Math.max(0, ...teamSections.filter((x) => x.team).map((x) => scoreOf(x.members)));

  const grid = teamView && !searching ? (
    <div className="space-y-6">
      {teamSections.map(({ team, members }) => {
        const score = scoreOf(members);
        return (
          <section key={team?.id ?? 'none'} aria-label={team ? `Команда ${team.name}` : 'Без команды'}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span aria-hidden className={`shrink-0 rounded-full ${projector ? 'size-6' : 'size-4'}`} style={{ background: team?.color ?? 'var(--line)' }} />
              <h2 className={projector ? 'text-3xl' : 'text-lg'}>{team?.name ?? 'Без команды'}</h2>
              {team && (
                <span className={`chip bg-plus-bg text-plus ${projector ? 'text-xl' : ''}`}>
                  +{score}
                  <span className="sr-only"> баллов</span> сегодня
                </span>
              )}
              {team && score > 0 && score === best && <span className={`chip bg-accent text-on-accent ${projector ? 'text-xl' : ''}`}>лидер</span>}
              {team && !projector && !archived && !selectMode && members.length > 0 && (
                <button className="btn btn-secondary btn-sm ml-auto" onClick={() => setTarget({ ids: members.map((m) => m.id), label: `Команда «${team.name}»` })}>
                  Начислить команде
                </button>
              )}
            </div>
            {members.length ? <div className={gridClass}>{members.map(card)}</div> : <p className="text-sm text-ink-soft">В команде пока никого.</p>}
          </section>
        );
      })}
    </div>
  ) : (
    visibleStudents.length > 0 ? <div className={gridClass}>{visibleStudents.map(card)}</div> : (
      <p className="rounded-2xl bg-surface-2 p-5 text-ink-soft">Ученики не найдены. Попробуйте другое имя, фамилию или логин.</p>
    )
  );

  return (
    <>
      {!projector && <StudentSearch value={query} onChange={search} found={visibleStudents.length} total={students.length} />}
      {!archived && <div className="flex flex-wrap items-center gap-2">
        {selectMode ? (
          <>
            <button className="btn btn-secondary" onClick={() => setSelected(new Set(visibleStudents.map((s) => s.id)))} disabled={!visibleStudents.length}>
              <SelectionAllIcon size={20} /> {searching ? 'Выбрать найденных' : 'Выбрать всех'}
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
            <button
              className={`btn ${teamView ? 'btn-secondary ring-2 ring-ink' : 'btn-secondary'}`}
              aria-pressed={teamView}
              onClick={() => {
                if (!data.teams.length) return setTeamsOpen(true);
                setTeamMode(!teamMode);
                rememberTeamMode(data.group.id, !teamMode);
              }}
            >
              <FlagBannerIcon size={20} /> Команды
            </button>
            {teamView && (
              <button className="btn btn-ghost" onClick={() => setTeamsOpen(true)}>
                Настроить команды
              </button>
            )}
            <button className="btn btn-secondary ml-auto hidden sm:inline-flex" onClick={() => setProjector(true)}>
              <ProjectorScreenIcon size={20} /> Проектор
            </button>
          </>
        )}
      </div>}

      {searching && !selectMode && <p className="text-sm text-ink-soft">«Всей группе» начисляет баллы всем ученикам. Для найденных используйте «Несколько».</p>}
      {grid}

      {/* Панель выбора нескольких учеников */}
      {selectBar.mounted && (
        <div
          className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur ${
            selectBar.closing ? 'anim-bar-out' : 'anim-bar-in'
          }`}
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
        </div>
      )}
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

      <TeamsModal
        open={teamsOpen}
        groupId={data.group.id}
        teams={data.teams}
        students={students}
        onClose={() => {
          setTeamsOpen(false);
          void reload();
        }}
        onSaved={async () => {
          await reload();
          setTeamMode(true);
          rememberTeamMode(data.group.id, true);
        }}
      />
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
    <button
      type="button"
      onClick={() => onClick(s)}
      aria-pressed={selectable ? selected : undefined}
      className={`card relative flex flex-col items-stretch overflow-hidden p-2.5 text-left transition-[box-shadow,opacity,transform] duration-200 ease-[var(--ease-out)] hover:shadow-[var(--shadow-pop)] active:scale-[0.97] ${
        selected ? 'ring-4 ring-accent' : ''
      } ${absent ? 'opacity-55' : ''}`}
    >
      {/* Картинка и значки на ней — оформление; для экранного диктора то же самое есть текстом ниже */}
      <div className="relative rounded-xl" style={{ background: heroTint(s.hero.parts) }} aria-hidden>
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
        {/* Ключ перезапускает CSS-анимацию при каждом новом начислении */}
        {burst?.level && (
          <span key={`lvl-${burst.key}`} className="anim-flash pointer-events-none absolute inset-0 rounded-xl ring-4 ring-accent" />
        )}
        {burst?.level && (
          <span
            key={`lvl-text-${burst.key}`}
            className="anim-level-badge pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ink px-3 py-1 font-display text-sm text-bg shadow-[var(--shadow-pop)]"
          >
            Уровень {burst.level}!
          </span>
        )}
        {burst && (
          <span
            key={burst.key}
            className="anim-points-burst pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit rounded-full bg-accent px-3 py-1 font-display text-2xl text-on-accent shadow-[var(--shadow-pop)]"
          >
            +{burst.value}
          </span>
        )}
      </div>
      <div className={`px-1 pb-0.5 pt-2.5 ${big ? 'pt-3' : ''}`}>
        <div className={`truncate font-semibold ${big ? 'text-xl' : ''}`}>{s.name}</div>
        <div className={`mt-0.5 flex items-center justify-between text-ink-soft ${big ? 'text-base' : 'text-sm'}`}>
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-ink">
            <StarIcon size={big ? 18 : 15} weight="fill" className="text-accent" aria-hidden />
            <span className="sr-only">всего </span>
            {s.totalEarned}
          </span>
          <span>ур. {s.level}</span>
        </div>
        {s.todayEarned > 0 && <span className="sr-only">, сегодня +{s.todayEarned}</span>}
        {absent && <span className="sr-only">, нет на уроке</span>}
      </div>
    </button>
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
          <div
            key={done ? 'done' : s.id}
            className={`w-48 rounded-2xl p-2 transition-colors ${done ? 'anim-pop-big bg-accent/30' : 'bg-surface-2'}`}
          >
            <HeroAvatar parts={s.hero.parts} className="aspect-[5/6]" />
          </div>
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
