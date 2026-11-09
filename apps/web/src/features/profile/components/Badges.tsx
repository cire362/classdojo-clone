import { CalendarCheckIcon, HandshakeIcon, TrophyIcon } from '@phosphor-icons/react';
import type { BadgeId, StudentBadge } from '@heroes/shared';
import { ProgressBar } from '../../../ui';
import { useTerms } from '../../auth';

const ICONS = { 'attendance.streak10': CalendarCheckIcon, 'help.20': HandshakeIcon, 'level.first5': TrophyIcon } satisfies Record<BadgeId, typeof TrophyIcon>;

export function BadgeSummary({ badges, onOpen }: { badges: StudentBadge[]; onOpen: () => void }) {
  const t = useTerms();
  const earned = badges.filter((b) => b.earnedOn);
  return (
    <section aria-label="Значки достижений" className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-5">
      <div className="min-w-0">
        <h2 className="font-sans text-lg font-semibold">Значки достижений <span className="text-ink-soft tabular-nums">{earned.length} из {badges.length}</span></h2>
        {earned.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {earned.map((b) => { const Icon = ICONS[b.id]; return <li key={b.id} className="chip gap-2 bg-accent/30"><Icon size={18} aria-hidden />{b.title}</li>; })}
          </ul>
        ) : <p className="mt-1 text-sm text-ink-soft">
          За посещаемость, помощь {t.kind === 'SCHOOL' ? 'друзьям' : 'одногруппникам'} и рост героя.
        </p>}
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onOpen}>Все значки</button>
    </section>
  );
}

export function Badges({ badges }: { badges: StudentBadge[] }) {
  return (
    <section aria-label="Условия получения значков" className="space-y-4">
      <div>
        <h3 className="font-sans text-lg font-semibold">Значки достижений</h3>
        <p className="mt-1 max-w-[65ch] text-sm text-ink-soft">Появляются автоматически по истории уроков. Исправление ошибочных записей меняет и достижения.</p>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {badges.map((b) => {
          const Icon = ICONS[b.id];
          return (
            <li key={b.id} className={`flex flex-col rounded-2xl border p-5 ${b.earnedOn ? 'border-ink/25 bg-accent/15' : 'border-line bg-surface'}`}>
              <div className="flex items-center gap-3">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${b.earnedOn ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-soft'}`}><Icon size={24} aria-hidden weight={b.earnedOn ? 'fill' : 'regular'} /></span>
                <span className="text-sm font-medium">{b.earnedOn ? 'Получен' : 'Ещё впереди'}</span>
              </div>
              <h4 className="mt-4 font-sans text-base font-semibold">{b.title}</h4>
              <p className="mt-1 text-sm text-ink-soft">{b.description}</p>
              <div className="mt-auto pt-4">
                {b.earnedOn ? <p className="text-sm font-medium">Получен {new Date(`${b.earnedOn}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}{b.groupName && <span className="mt-1 block break-words text-ink-soft">Группа: {b.groupName}</span>}</p>
                  : b.target > 1 && <>
                    <p className="text-sm tabular-nums">{b.id === 'attendance.streak10' ? 'Лучшая серия' : 'Случаев помощи'}: {b.progress} из {b.target}</p>
                    <ProgressBar value={b.progress / b.target} label={b.title} valueText={`${b.progress} из ${b.target}`} className="mt-2" />
                  </>}
                {b.note && <p className="mt-3 text-xs leading-relaxed text-ink-soft">{b.note}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
