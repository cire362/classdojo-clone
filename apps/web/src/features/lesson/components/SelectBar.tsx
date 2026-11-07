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
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur ${
        bar.closing ? 'anim-bar-out' : 'anim-bar-in'
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
