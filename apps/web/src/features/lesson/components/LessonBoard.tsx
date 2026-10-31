import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DiceFiveIcon, UserPlusIcon, XIcon } from '@phosphor-icons/react';
import { ClassGoalPanel } from '../../goals';
import { useGroup } from '../../groups';
import { StudentSearch, matchesStudent } from '../../students';
import { TeamsModal } from '../../teams';
import type { ClassGoal, LessonStudent, Reason } from '../../../lib/api';
import { EmptyState } from '../../../ui';
import { useAward } from '../hooks/useAward';
import { useProjector } from '../hooks/useProjector';
import { useTeamMode } from '../hooks/useTeamMode';
import { LessonNoiseMeter } from './LessonNoiseMeter';
import { LessonRandomGroups } from './LessonRandomGroups';
import { LessonTimer } from './LessonTimer';
import { LessonToolbar } from './LessonToolbar';
import { RandomPicker } from './RandomPicker';
import { ReasonPicker } from './ReasonPicker';
import { SelectBar } from './SelectBar';
import { StudentCard } from './StudentCard';
import { TeamSections } from './TeamSections';

export function LessonBoard() {
  const { data, setData, reload } = useGroup();
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [projector, setProjector] = useProjector();
  const [timerTarget, setTimerTarget] = useState<HTMLDivElement | null>(null);
  const [randomOpen, setRandomOpen] = useState(false);
  const [teamMode, setTeamMode] = useTeamMode(data.group.id);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const teamView = teamMode && data.teams.length > 0;
  const { bursts, award } = useAward(() => {
    setSelected(new Set());
    setSelectMode(false);
  });
  const navigate = useNavigate();

  const students = data.students;
  // Поиск скрывает карточки только на рабочем экране; проектор показывает всю группу.
  const searching = !projector && !!query.trim();
  const visibleStudents = searching ? students.filter((s) => matchesStudent(s, query)) : students;
  function search(value: string) {
    setQuery(value);
    setSelected(new Set());
  }
  const archived = !!data.group.archivedAt;
  const present = data.todayAttendance ? new Set(data.todayAttendance.presentStudentIds) : null;

  const changeGoal = (classGoal: ClassGoal | null) => setData((current) => current && ({ ...current, classGoal }));
  const goalPanel = <ClassGoalPanel goal={data.classGoal} groupId={data.group.id} archived={archived} onChange={changeGoal} />;
  const tools = !archived && (
    <div className="flex flex-wrap items-start gap-2">
      <LessonTimer key={data.group.id} groupId={data.group.id} projector={projector} target={timerTarget} />
      <LessonNoiseMeter key={`noise:${data.group.id}`} groupId={data.group.id} projector={projector} target={timerTarget} />
      <LessonRandomGroups
        key={`random-groups:${data.group.id}`}
        students={students}
        presentIds={data.todayAttendance?.presentStudentIds ?? null}
        projector={projector}
        target={timerTarget}
      />
    </div>
  );

  async function pickReason(reason: Reason) {
    if (!target) return;
    const ids = target.ids;
    setTarget(null);
    await award(ids, reason);
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

  if (!students.length) {
    return (
      <>
        {goalPanel}
        {tools}
        <h2 className="sr-only">Ученики</h2>
        <EmptyState icon={<UserPlusIcon size={28} />} title="В группе пока нет учеников">
          <p>Добавьте учеников списком, и у каждого появится свой герой.</p>
          <Link to="students" className="btn btn-primary mt-4">
            Добавить учеников
          </Link>
        </EmptyState>
      </>
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

  const grid = teamView && !searching ? (
    <TeamSections
      students={students}
      teams={data.teams}
      projector={projector}
      canAward={!projector && !archived && !selectMode}
      gridClass={gridClass}
      card={card}
      onAward={(members, label) => setTarget({ ids: members.map((m) => m.id), label })}
    />
  ) : (
    visibleStudents.length > 0 ? <div className={gridClass}>{visibleStudents.map(card)}</div> : (
      <p className="rounded-2xl bg-surface-2 p-5 text-ink-soft">Ученики не найдены. Попробуйте другое имя, фамилию или логин.</p>
    )
  );

  return (
    <>
      {!projector && goalPanel}
      {tools}
      {!projector && <StudentSearch value={query} onChange={search} found={visibleStudents.length} total={students.length} />}
      {!archived && (
        <LessonToolbar
          selectMode={selectMode}
          searching={searching}
          hasVisible={visibleStudents.length > 0}
          teamView={teamView}
          onSelectVisible={() => setSelected(new Set(visibleStudents.map((s) => s.id)))}
          onCancelSelect={() => {
            setSelectMode(false);
            setSelected(new Set());
          }}
          onAwardAll={() => setTarget({ ids: students.map((s) => s.id), label: 'Вся группа' })}
          onStartSelect={() => setSelectMode(true)}
          onRandom={() => setRandomOpen(true)}
          onTeams={() => {
            if (!data.teams.length) return setTeamsOpen(true);
            setTeamMode(!teamMode);
          }}
          onSetupTeams={() => setTeamsOpen(true)}
          onProjector={() => setProjector(true)}
        />
      )}

      {searching && !selectMode && <p className="text-sm text-ink-soft">«Всей группе» начисляет баллы всем ученикам. Для найденных используйте «Несколько».</p>}
      {grid}

      <SelectBar active={selectMode} count={selected.size} onAward={(label) => setTarget({ ids: [...selected], label })} />
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
          <div ref={setTimerTarget} />
          <ClassGoalPanel goal={data.classGoal} groupId={data.group.id} archived={archived} projector />
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
        }}
      />
      <ReasonPicker
        open={!!target}
        label={target?.label ?? ''}
        reasons={data.reasons}
        onPick={pickReason}
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
