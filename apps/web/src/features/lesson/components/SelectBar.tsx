import { pluralize } from '../../../lib/hooks';
import { usePresence } from '../../../lib/presence';
import { useTerms } from '../../auth';

/** Панель выбора нескольких учеников */
export function SelectBar({ active, count, onAward }: { active: boolean; count: number; onAward: (label: string) => void }) {
  const t = useTerms();
  const bar = usePresence(active, 200);
  if (!bar.mounted) return null;
  return (
    <div
      className={`sticky bottom-0 z-30 -mx-4 border-t border-line bg-surface/95 px-4
        pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:px-6 ${
        bar.closing ? 'anim-fade-out' : 'anim-fade-in'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <span className="font-semibold tabular-nums">
          Выбрано: {count}
        </span>
        <button
          className="btn btn-primary"
          disabled={!count}
          onClick={() => onAward(`${count} ${pluralize(count, t.student.one.nom, t.student.one.gen, t.student.many.gen)}`)}
        >
          Начислить
        </button>
      </div>
    </div>
  );
}
