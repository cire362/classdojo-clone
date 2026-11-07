import type { ReactNode } from 'react';
import { CheckCircleIcon, FlagBannerIcon } from '@phosphor-icons/react';
import type { SchoolGoal } from '../../../lib/api';
import { pluralize, points } from '../../../lib/hooks';
import { ProgressBar } from '../../../ui';

/** Общая цель школы: копят все классы вместе, поэтому видно только общий счёт */
export function SchoolGoalCard({ goal, children }: { goal: SchoolGoal; children?: ReactNode }) {
  const target = `${goal.target} ${pluralize(goal.target, 'балла', 'баллов', 'баллов')}`;
  return (
    <section
      aria-label="Цель школы"
      className={`rounded-2xl border p-4 sm:p-5 ${goal.reached ? 'border-accent bg-accent/10' : 'border-line bg-surface'}`}
    >
      <div className="flex items-start gap-3">
        {goal.reached
          ? <CheckCircleIcon size={26} weight="fill" className="shrink-0 text-plus" aria-hidden />
          : <FlagBannerIcon size={26} weight="bold" className="shrink-0 text-ink-soft" aria-hidden />}
        <h2 className="min-w-0 flex-1 break-words text-lg leading-snug">Цель школы: {goal.title}</h2>
      </div>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-sm">
        <p className="font-semibold tabular-nums">Все классы собрали {goal.earned} из {target}</p>
        <p className={`font-semibold ${goal.reached ? 'text-plus' : 'text-ink-soft'}`}>
          {goal.reached ? 'Цель достигнута!' : `Осталось ${points(goal.target - goal.earned)}`}
        </p>
      </div>
      <ProgressBar
        value={goal.earned / goal.target}
        label={`Цель школы: ${goal.title}`}
        valueText={`${goal.earned} из ${target}`}
        className="mt-3"
      />
      {children}
    </section>
  );
}
