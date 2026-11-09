import { Link } from 'react-router-dom';
import type { Reason } from '../../../lib/api';
import { Modal } from '../../../ui';
import { Glyph } from '../../../ui/Glyph';

export function ReasonPicker({
  open,
  label,
  reasons,
  onPick,
  onClose,
  groupId,
}: {
  open: boolean;
  label: string;
  reasons: Reason[];
  onPick: (r: Reason) => void;
  onClose: () => void;
  groupId: string;
}) {
  const plus = reasons.filter((r) => r.value > 0);
  const minus = reasons.filter((r) => r.value < 0);
  const tile = (r: Reason) => (
    <button
      key={r.id}
      onClick={() => onPick(r)}
      className="flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-ink active:scale-[0.97]"
    >
      <Glyph name={r.emoji} size={30} className={r.value > 0 ? 'text-plus' : 'text-minus'} />
      <span className="flex w-full items-end justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{r.name}</span>
        <span className={`chip shrink-0 ${r.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>
          {r.value > 0 ? `+${r.value}` : `−${Math.abs(r.value)}`}
        </span>
      </span>
    </button>
  );
  return (
    <Modal open={open} title={label} onClose={onClose} size="lg">
      {reasons.length === 0 ? (
        <p className="text-ink-soft">
          Причин нет. <Link to={`/g/${groupId}/reasons`} className="font-semibold text-ink underline">Добавьте их</Link>.
        </p>
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink-soft">Молодец</h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{plus.map(tile)}</div>
          </section>
          {minus.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink-soft">Нужно поработать</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{minus.map(tile)}</div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
