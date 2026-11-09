import { useState } from 'react';
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, FlagBannerIcon, LightbulbIcon } from '@phosphor-icons/react';
import { walkGarden, type Direction, type GardenLevel } from '@heroes/shared/world';
import type { WorldState } from '@heroes/shared/api';
import { HeroAvatar } from '../../hero';

const CONTROLS = [
  ['up', 'Вверх', ArrowUpIcon], ['left', 'Влево', ArrowLeftIcon],
  ['down', 'Вниз', ArrowDownIcon], ['right', 'Вправо', ArrowRightIcon],
] as const;
const KEYS: Record<string, Direction> = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };

export function GardenBoard({ level, hero, disabled, onSolve }: {
  level: GardenLevel; hero: WorldState['hero']; disabled: boolean; onSolve: (moves: Direction[]) => Promise<boolean>;
}) {
  const [moves, setMoves] = useState<Direction[]>([]);
  const [message, setMessage] = useState('');
  const result = walkGarden(level, moves);
  const width = level.rows[0].length;
  const move = (direction: Direction) => {
    if (disabled) return;
    const next = [...moves, direction];
    if (next.length > level.maxSteps) { setMessage('Шаги закончились. Отмени шаг или попробуй другой маршрут.'); return; }
    if (!walkGarden(level, next).valid) { setMessage('Здесь камень или край сада. Выбери другое направление.'); return; }
    setMoves(next); setMessage('');
  };
  const cells = [...level.rows.join('')];
  return <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label={level.title}>
    <div className="space-y-3">
      <h2 className="text-xl">{level.title}</h2>
      <p className="text-ink-soft">{level.story}</p>
      <div role="group" aria-label="Поле маршрута, управление стрелками" tabIndex={0}
        className="grid aspect-square max-w-md gap-1 rounded-2xl border border-line bg-surface-2 p-2 outline-offset-4"
        style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
        onKeyDown={(e) => { if (KEYS[e.key]) { e.preventDefault(); move(KEYS[e.key]); } }}>
        {cells.map((cell, i) => <div key={i} className={`relative flex items-center justify-center rounded-lg
          ${cell === '#' ? 'bg-ink/20' : result.path.includes(i) ? 'bg-accent/35' : 'bg-surface'}`}>
          <span className="sr-only">Строка {Math.floor(i / width) + 1}, столбец {i % width + 1}: {
            cell === '#' ? 'камень' : cell === '*' ? 'фонарь' : cell === 'G' ? 'маяк' : cell === 'S' ? 'старт' : 'дорожка'
          }</span>
          {cell === '*' && <LightbulbIcon size={25} weight={result.lit.includes(i) ? 'fill' : 'regular'} />}
          {cell === 'G' && <FlagBannerIcon size={25} />}
          {i === result.position && <HeroAvatar parts={hero.parts} level={hero.level} crop="head"
            className="absolute inset-0 h-full w-full" />}
        </div>)}
      </div>
    </div>
    <div className="flex flex-col justify-center gap-4">
      <p>Зажги все фонари и дойди до флага. Камни обходи. Управляй кнопками или стрелками, когда поле в фокусе.</p>
      <p role="status" className="text-sm">Строка {Math.floor(result.position / width) + 1}, столбец {result.position % width + 1}.
        {' '}Фонари: {result.lit.length} из {cells.filter((c) => c === '*').length}. Шаги: {moves.length} из {level.maxSteps}.</p>
      <div className="grid max-w-xs grid-cols-2 gap-2">
        {CONTROLS.map(([direction, label, Icon]) => <button key={direction} className="btn btn-secondary"
          disabled={disabled} onClick={() => move(direction)}><Icon size={20} />{label}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" disabled={disabled || !moves.length}
          onClick={() => { setMoves((v) => v.slice(0, -1)); setMessage(''); }}>Отменить шаг</button>
        <button className="btn btn-ghost" disabled={disabled || !moves.length}
          onClick={() => { setMoves([]); setMessage(''); }}>Сначала</button>
      </div>
      {message && <p role="status" className="text-sm text-ink-soft">{message}</p>}
      <button className="btn btn-primary" disabled={disabled || !result.won}
        onClick={async () => { if (await onSolve(moves)) setMessage('Место восстановлено! Выбери следующее на карте.'); }}>
        Зажечь маяк
      </button>
    </div>
  </section>;
}
