import { TrophyIcon } from '@phosphor-icons/react';
import type { ClassRatingRow, RatingPeriod } from '../../../lib/api';
import { pluralize } from '../../../lib/hooks';

const PERIODS: [RatingPeriod, string][] = [['week', 'Неделя'], ['month', 'Месяц']];

/**
 * Рейтинг классов школы: плюсы на ученика за неделю или месяц. Только суммы класса — отдельные дети
 * здесь не видны и между собой не сравниваются
 */
export function ClassRating({ rows, period, onPeriod }: {
  rows: ClassRatingRow[];
  period: RatingPeriod;
  onPeriod: (p: RatingPeriod) => void;
}) {
  return (
    <section className="space-y-3" aria-labelledby="class-rating-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="class-rating-title" className="flex items-center gap-2 text-lg">
          <TrophyIcon size={22} aria-hidden /> Рейтинг классов
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
      <p className="text-sm text-ink-soft">Плюсы класса в среднем на ученика: так большой класс не выигрывает числом.</p>
      {rows.length === 0 ? (
        <p className="text-ink-soft">В школе пока нет классов с учениками.</p>
      ) : (
        <ol className="card divide-y divide-line overflow-hidden" aria-label="Места классов">
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
                  {r.groupName} {r.mine && <span className="chip ml-1 bg-accent text-on-accent">Ваш класс</span>}
                </span>
                <span className="block text-sm text-ink-soft">{r.teacherName}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular-nums">{r.perStudent.toLocaleString('ru-RU')} на ученика</span>
                <span className="block text-sm text-ink-soft">
                  {r.earned} {pluralize(r.earned, 'балл', 'балла', 'баллов')} ·{' '}
                  {r.students} {pluralize(r.students, 'ученик', 'ученика', 'учеников')}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
