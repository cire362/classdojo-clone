import { GARDEN_LEVELS } from '@heroes/shared/world';
import { CheckCircleIcon, LockSimpleIcon, SunIcon } from '@phosphor-icons/react';
const PLACES = [[16, 76], [39, 66], [23, 38], [52, 34], [76, 53], [84, 18]];

/** Карта сада — оригинальная игровая сцена, а подписи и управление остаются обычными HTML-кнопками. */
export function WorldMap({ completed, selected, onSelect, preview = false }: {
  completed: string[]; selected: number; onSelect: (index: number) => void;
  /** Просмотр преподавателем: все места открыты для знакомства */
  preview?: boolean;
}) {
  return <div className="space-y-4">
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface-2">
      <svg viewBox="0 0 600 250" className="w-full" role="img" aria-label={`Сад маяков: восстановлено ${completed.length} из 6 мест`}>
        <path d="M0 175 Q110 75 260 170 T600 115 V250 H0Z" fill="var(--plus)" opacity=".12" />
        <path d="M0 220 Q150 160 320 210 T600 150 V250 H0Z" fill="var(--plus)" opacity=".15" />
        <path d="M96 190 Q260 200 234 165 T138 95 Q200 32 312 85 T456 132 Q560 150 504 45"
          fill="none" stroke="var(--ink-soft)" strokeWidth="3" strokeDasharray="5 7" opacity=".4" />
        {PLACES.map(([x, y], i) => <g key={i} transform={`translate(${x * 6} ${y * 2.5})`}>
          {completed.includes(GARDEN_LEVELS[i].id) && <circle cy="-14" r="25" fill="var(--accent)" opacity=".3" />}
          <path d="M-10 8 L-7-23 L7-23 L10 8Z" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
          <path d="M-11-23 L0-35 L11-23Z" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2" />
          <rect x="-4" y="-19" width="8" height="9" rx="2" fill={completed.includes(GARDEN_LEVELS[i].id)
            ? 'var(--accent)' : 'var(--ink-soft)'} />
          <text y="26" textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="700">{i + 1}</text>
        </g>)}
      </svg>
    </div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Места сада">
      {GARDEN_LEVELS.map((level, i) => {
        const done = completed.includes(level.id);
        const locked = !preview && GARDEN_LEVELS.slice(0, i).some((l) => !completed.includes(l.id));
        const Icon = locked ? LockSimpleIcon : done ? CheckCircleIcon : SunIcon;
        const name = `${i + 1}. ${level.title}`;
        return <button key={level.id} className={`btn justify-start ${selected === i ? 'btn-primary' : 'btn-secondary'}`}
          disabled={locked} aria-pressed={selected === i} onClick={() => onSelect(i)}
          aria-label={`${name}${done ? ', восстановлено' : locked ? ', закрыто' : ''}`}>
          <Icon size={20} className="shrink-0" aria-hidden />
          <span>{name}</span>
        </button>;
      })}
    </div>
  </div>;
}
