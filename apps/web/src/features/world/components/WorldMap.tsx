import { GARDEN_LEVELS } from '@heroes/shared/world';
import { CheckIcon, LockSimpleIcon } from '@phosphor-icons/react';
import { GardenScene, MAP_H, MAP_W, PLACES } from './GardenScene';

/**
 * Карта сада: рисунок с тропой через шесть мест, метки мест — обычные кнопки поверх рисунка. Тропа светится
 * до следующего невосстановленного места, восстановленные ориентиры зажигаются. Подписи мест видны, когда карта шире 512 px,
 * на узкой карте название выбранного места стоит над полем головоломки.
 */
export function WorldMap({ completed, selected, onSelect, preview = false }: {
  completed: string[]; selected: number; onSelect: (index: number) => void;
  /** Просмотр преподавателем: все места открыты для знакомства */
  preview?: boolean;
}) {
  const lit = GARDEN_LEVELS.map((l) => completed.includes(l.id));
  const done = lit.indexOf(false) < 0 ? lit.length : lit.indexOf(false);
  return (
    <div className="@container relative overflow-hidden rounded-2xl border border-line shadow-card">
      <GardenScene lit={lit} done={preview ? 0 : done} />
      <p className="sr-only">Сад маяков: восстановлено {completed.length} из {GARDEN_LEVELS.length} мест</p>
      <div role="group" aria-label="Места сада">
        {GARDEN_LEVELS.map((level, i) => {
          const locked = !preview && i > done;
          const current = selected === i;
          const name = `${i + 1}. ${level.title}`;
          const marker = current
            ? 'bg-accent text-on-accent border-accent ring-4 ring-accent/25'
            : lit[i]
              ? 'bg-surface text-accent border-accent'
              : locked
                ? 'bg-surface-2 text-ink-soft border-line'
                : 'bg-surface text-ink border-ink';
          return (
            <button
              key={level.id}
              type="button"
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center disabled:cursor-not-allowed"
              style={{ left: `${(PLACES[i][0] / MAP_W) * 100}%`, top: `${(PLACES[i][1] / MAP_H) * 100}%` }}
              disabled={locked}
              aria-pressed={current}
              aria-label={`${name}${lit[i] ? ', восстановлено' : locked ? ', закрыто' : ''}`}
              onClick={() => onSelect(i)}
            >
              <span className={`flex size-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold
                shadow-card @lg:size-11 transition group-enabled:group-hover:scale-105 group-active:scale-95 ${marker}`}>
                {lit[i] && !current ? <CheckIcon size={18} weight="bold" /> : locked ? <LockSimpleIcon size={16} /> : i + 1}
              </span>
              <span className={`pointer-events-none absolute top-full mt-1 hidden whitespace-nowrap rounded-full px-2 py-0.5
                text-xs font-semibold shadow-card @lg:block ${current ? 'bg-ink text-surface' : 'bg-surface text-ink'}`}>
                {level.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
