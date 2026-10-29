import { useMemo, useState, type ReactNode } from 'react';
import { CalendarCheckIcon, ClockCounterClockwiseIcon, StarIcon, TrashIcon, TrophyIcon } from '@phosphor-icons/react';
import { MAX_LEVEL } from '@heroes/shared';
import type { HistoryEvent, PointsSum, Profile } from '../api';
import { formatDate, pluralize } from '../hooks';
import { HeroAvatar } from './HeroAvatar';
import { Portfolio, type PortfolioEdit } from './Portfolio';
import { Badges, BadgeSummary } from './Badges';
import { PetCompanion } from './PetCompanion';
import { EmptyState, ProgressBar } from './ui';

function PointsTile({ label, sum, featured = false }: { label: string; sum: PointsSum; featured?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${featured ? 'bg-ink text-bg' : 'bg-surface-2'}`}>
      <div className={`text-sm font-medium ${featured ? 'opacity-75' : 'text-ink-soft'}`}>{label}</div>
      <div className="mt-1 font-display text-3xl tabular-nums">+{sum.earned}</div>
      <div className={`mt-1 text-sm tabular-nums ${featured ? 'opacity-75' : 'text-ink-soft'}`}>
        {sum.lost > 0 ? `списано ${sum.lost}, итого ${sum.net}` : 'без списаний'}
      </div>
    </div>
  );
}

export function ProfileView({
  profile,
  actions,
  isOwn,
  onDeleteEvent,
  portfolioEdit,
}: {
  profile: Profile;
  actions?: ReactNode;
  isOwn: boolean;
  /** Только для преподавателя: удаление ошибочной записи */
  onDeleteEvent?: (e: HistoryEvent) => void;
  /** Только для преподавателя: добавление и удаление записей портфолио */
  portfolioEdit?: PortfolioEdit;
}) {
  const [tab, setTab] = useState<'history' | 'attendance' | 'portfolio'>('history');
  const { level, points, hero } = profile;

  const historyByDay = useMemo(() => {
    const groups: { day: string; items: Profile['history'] }[] = [];
    for (const e of profile.history) {
      const d = new Date(e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const last = groups[groups.length - 1];
      if (last?.day === key) last.items.push(e);
      else groups.push({ day: key, items: [e] });
    }
    return groups;
  }, [profile.history]);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="relative overflow-hidden rounded-2xl bg-accent/30 px-6 pt-6">
          <div
            aria-hidden
            className="absolute inset-0 opacity-25"
            style={{ backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          />
          <HeroAvatar parts={hero.parts} level={level.level} title={hero.name || profile.student.name} className="relative mx-auto aspect-[5/6] max-w-[280px]" />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium text-ink-soft">
              {profile.student.name}, {profile.student.group.name}
            </p>
            <h1 className="mt-1 text-3xl leading-[1.1] sm:text-4xl">{hero.name || (isOwn ? 'Безымянный герой' : profile.student.name)}</h1>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-accent font-display text-xl text-on-accent">{level.level}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {level.level} уровень: {level.title}
                </div>
                <div className="text-sm text-ink-soft">
                  {level.nextThreshold === null
                    ? 'Максимальный уровень. Легендарно!'
                    : `До ${level.level + 1} уровня ${level.pointsToNext} ${pluralize(level.pointsToNext, 'балл', 'балла', 'баллов')}`}
                </div>
              </div>
              <TrophyIcon size={26} className="text-ink-soft" />
            </div>
            <ProgressBar className="mt-4" value={level.progress} label={`Прогресс до ${Math.min(level.level + 1, MAX_LEVEL)} уровня`} />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <PointsTile label="Сегодня" sum={points.today} />
            <PointsTile label="Неделя" sum={points.week} />
            <PointsTile label="Всего" sum={points.total} featured />
          </div>
          <PetCompanion parts={hero.parts} level={level.level} />
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </section>

      <BadgeSummary badges={profile.badges} onOpen={() => setTab('portfolio')} />

      <section className="space-y-4">
        <div className="grid grid-cols-3 gap-1 sm:flex" role="tablist">
          <button role="tab" aria-selected={tab === 'history'} className={`tab flex-col justify-center gap-1 px-1 py-2 text-xs sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-sm ${tab === 'history' ? 'active' : 'bg-surface-2'}`} onClick={() => setTab('history')}>
            <ClockCounterClockwiseIcon size={18} weight="bold" /> История
          </button>
          <button role="tab" aria-selected={tab === 'attendance'} className={`tab flex-col justify-center gap-1 px-1 py-2 text-xs sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-sm ${tab === 'attendance' ? 'active' : 'bg-surface-2'}`} onClick={() => setTab('attendance')}>
            <CalendarCheckIcon size={18} weight="bold" /> Посещаемость
          </button>
          <button role="tab" aria-selected={tab === 'portfolio'} className={`tab flex-col justify-center gap-1 px-1 py-2 text-xs sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-sm ${tab === 'portfolio' ? 'active' : 'bg-surface-2'}`} onClick={() => setTab('portfolio')}>
            <TrophyIcon size={18} weight="bold" /> Портфолио
            {profile.portfolio.length > 0 && <span className="hidden tabular-nums opacity-70 sm:inline">{profile.portfolio.length}</span>}
          </button>
        </div>

        <h2 className="sr-only">{tab === 'history' ? 'История начислений' : tab === 'attendance' ? 'Посещаемость' : 'Портфолио'}</h2>
        {tab === 'portfolio' && <div className="space-y-8">
          <Badges badges={profile.badges} />
          <section aria-label="Достижения от преподавателя" className="space-y-4">
            <h3 className="font-sans text-lg font-semibold">Достижения от преподавателя</h3>
            <Portfolio items={profile.portfolio} edit={portfolioEdit} />
          </section>
        </div>}
        {tab === 'history' &&
          (historyByDay.length === 0 ? (
            <EmptyState icon={<StarIcon size={28} weight="fill" />} title="Баллов пока нет">
              {isOwn ? 'Работай на уроке, и здесь появятся первые звёзды.' : 'Начисления появятся здесь.'}
            </EmptyState>
          ) : (
            <div className="space-y-3">
            {onDeleteEvent && (
              <p className="text-sm text-ink-soft">
                Ошибочную запись можно удалить. Баллы за посещение меняются через отметку посещаемости.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {historyByDay.map((g) => (
                <div key={g.day} className="card p-4">
                  <h3 className="mb-2 font-sans text-sm font-semibold text-ink-soft">{formatDate(g.day)}</h3>
                  <ul className="space-y-1.5">
                    {g.items.map((e) => (
                      <li key={e.id} className="flex items-center gap-3">
                        <span className="w-7 text-center text-xl" aria-hidden>
                          {e.emoji}
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          <span className="block">{e.reasonName}</span>
                          <span className="block text-xs text-ink-soft">{e.author ?? 'Автор не указан'}</span>
                        </span>
                        <span className="text-sm text-ink-soft tabular-nums">
                          {new Date(e.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`chip w-12 justify-center ${e.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>
                          {e.value > 0 ? `+${e.value}` : `−${Math.abs(e.value)}`}
                        </span>
                        {onDeleteEvent &&
                          (e.attendance ? (
                            <span className="size-9 shrink-0" />
                          ) : (
                            <button
                              className="icon-btn size-9 hover:text-minus"
                              aria-label={`Удалить запись «${e.reasonName}»`}
                              title="Удалить запись"
                              onClick={() => onDeleteEvent(e)}
                            >
                              <TrashIcon size={18} />
                            </button>
                          ))}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            </div>
          ))}

        {tab === 'attendance' &&
          (profile.attendance.total === 0 ? (
            <EmptyState icon={<CalendarCheckIcon size={28} />} title="Отметок пока нет" />
          ) : (
            <div className="space-y-4">
              <p className="text-lg">
                Был на <b className="tabular-nums">{profile.attendance.attended}</b> из{' '}
                <b className="tabular-nums">{profile.attendance.total}</b>{' '}
                {pluralize(profile.attendance.total, 'урока', 'уроков', 'уроков')}
              </p>
              <ul className="flex flex-wrap gap-2">
                {profile.attendance.records.map((r) => (
                  <li
                    key={`${r.date}-${r.lesson}`}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${r.present ? 'bg-plus-bg text-plus' : 'bg-surface-2 text-ink-soft line-through'}`}
                    title={r.present ? 'Был' : 'Не был'}
                  >
                    {formatDate(r.date)}
                    {r.lesson > 1 || profile.attendance.records.some((o) => o.date === r.date && o.lesson !== r.lesson)
                      ? `, ${r.lesson}-й урок`
                      : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>
    </div>
  );
}
