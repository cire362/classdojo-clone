import { TrophyIcon } from '@phosphor-icons/react';
import type { ClassRatingRow, RatingPeriod } from '../../../lib/api';
import { pluralize } from '../../../lib/hooks';
import { cap, your } from '@heroes/shared/terms';
import { useTerms } from '../../auth';

const PERIODS: [RatingPeriod, string][] = [['week', 'Неделя'], ['month', 'Месяц']];

/**
 * Рейтинг групп учреждения: плюсы на ученика за неделю или месяц. Только суммы группы — отдельные дети
 * здесь не видны и между собой не сравниваются
 */
export function ClassRating({ rows, period, onPeriod }: {
  rows: ClassRatingRow[];
  period: RatingPeriod;
  onPeriod: (p: RatingPeriod) => void;
}) {
  const t = useTerms();
  const bigGroup = `${t.groupFeminine ? 'большая' : 'большой'} ${t.group.one.nom}`;
  const yours = cap(your(t.groupFeminine, t.group.one.nom));
  return (
    <section className="space-y-3" aria-labelledby="class-rating-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="class-rating-title" className="flex items-center gap-2 text-lg">
          <TrophyIcon size={22} aria-hidden /> Рейтинг {t.group.many.gen}
        </h2>
        <div className="flex gap-1" role="group" aria-label="Период рейтинга">
          {PERIODS.map(([key, label]) => (
            <button
              key={key}
              className={`tab ${period === key ? 'active' : ''}`}
              aria-pressed={period === key}
              onClick={() => onPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-ink-soft">
        Плюсы {t.group.one.gen} в среднем на {t.student.one.acc}: так {bigGroup} не выигрывает числом.
      </p>
      {rows.length === 0 ? (
        <p className="text-ink-soft">Пока нет {t.group.many.gen}, где есть {t.student.many.nom}.</p>
      ) : (
        <ol className="card divide-y divide-line overflow-hidden" aria-label={`Места ${t.group.many.gen}`}>
          {rows.map((r) => (
            <li key={r.groupId} className={`flex flex-wrap items-center gap-3 p-4 ${r.mine ? 'bg-accent/10' : ''}`}>
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-lg tabular-nums"
              >
                {r.place}
                <span className="sr-only"> место</span>
              </span>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block break-words font-semibold">
                  {r.groupName} {r.mine && <span className="chip ml-1 bg-accent text-on-accent">{yours}</span>}
                </span>
                <span className="block text-sm text-ink-soft">{r.teacherName}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular-nums">{r.perStudent.toLocaleString('ru-RU')} на {t.student.one.acc}</span>
                <span className="block text-sm text-ink-soft">
                  {r.earned} {pluralize(r.earned, 'балл', 'балла', 'баллов')} ·{' '}
                  {r.students} {pluralize(r.students, t.student.one.nom, t.student.one.gen, t.student.many.gen)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
