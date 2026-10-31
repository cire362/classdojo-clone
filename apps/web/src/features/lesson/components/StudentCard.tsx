import { memo } from 'react';
import { CheckIcon, StarIcon } from '@phosphor-icons/react';
import { HeroAvatar, heroTint } from '../../hero';
import type { LessonStudent } from '../../../lib/api';
import type { Burst } from '../hooks/useAward';

export const StudentCard = memo(function StudentCard({
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
      }`}
    >
      {/* Картинка и значки на ней — оформление; для экранного диктора то же самое есть текстом ниже */}
      <div className="relative rounded-xl" style={{ background: heroTint(s.hero.parts) }} aria-hidden>
        <HeroAvatar parts={s.hero.parts} level={s.level} className={`mx-auto aspect-[5/6] w-[88%] ${absent ? 'opacity-55' : ''}`} />
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
