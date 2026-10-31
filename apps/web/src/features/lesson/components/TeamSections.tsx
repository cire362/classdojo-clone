import type { ReactNode } from 'react';
import type { LessonStudent, Team } from '../../../lib/api';

/** Командный режим: карточки по командам, счёт команды — сумма баллов участников за сегодня */
export function TeamSections({ students, teams, projector, canAward, gridClass, card, onAward }: {
  students: LessonStudent[];
  teams: Team[];
  projector: boolean;
  canAward: boolean;
  gridClass: string;
  card: (s: LessonStudent) => ReactNode;
  onAward: (members: LessonStudent[], label: string) => void;
}) {
  const sections = [
    ...teams.map((team) => ({ team, members: students.filter((s) => s.teamId === team.id) })),
    { team: null, members: students.filter((s) => !s.teamId || !teams.some((t) => t.id === s.teamId)) },
  ].filter((x) => x.team || x.members.length);
  const scoreOf = (members: LessonStudent[]) => members.reduce((sum, s) => sum + s.todayEarned, 0);
  const best = Math.max(0, ...sections.filter((x) => x.team).map((x) => scoreOf(x.members)));

  return (
    <div className="space-y-6">
      {sections.map(({ team, members }) => {
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
              {team && canAward && members.length > 0 && (
                <button className="btn btn-secondary btn-sm ml-auto" onClick={() => onAward(members, `Команда «${team.name}»`)}>
                  Начислить команде
                </button>
              )}
            </div>
            {members.length ? <div className={gridClass}>{members.map(card)}</div> : <p className="text-sm text-ink-soft">В команде пока никого.</p>}
          </section>
        );
      })}
    </div>
  );
}
