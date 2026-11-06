import { useId, useState, type FormEvent } from 'react';
import { REPORT_REASONS, type ReportReason } from '@heroes/shared';
import { Modal } from '../../../ui';

const REASONS = Object.entries(REPORT_REASONS) as [ReportReason, string][];

/** Причина жалобы и пояснение. onSubmit возвращает true, если жалоба принята: тогда окно закрывается */
export function ReportModal({ open, target, onClose, onSubmit }: {
  open: boolean;
  target: 'post' | 'comment';
  onClose: () => void;
  onSubmit: (reason: ReportReason, note: string) => Promise<boolean>;
}) {
  const id = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    if (await onSubmit(reason, note.trim())) {
      setReason(null);
      setNote('');
    }
    setBusy(false);
  }

  return (
    <Modal open={open} title={target === 'post' ? 'Жалоба на запись' : 'Жалоба на комментарий'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          Жалобу увидят только преподаватели группы. После трёх жалоб от разных родителей текст скрывается до их решения.
        </p>
        <fieldset className="space-y-2">
          <legend className="label">Что не так</legend>
          {REASONS.map(([key, label]) => (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                reason === key ? 'border-ink bg-accent/15 ring-2 ring-ink' : 'border-line hover:border-ink-soft'
              }`}
            >
              <input type="radio" name={`${id}-reason`} className="sr-only" checked={reason === key} onChange={() => setReason(key)} />
              {label}
            </label>
          ))}
        </fieldset>
        <div>
          <label className="label" htmlFor={`${id}-note`}>Пояснение, если нужно</label>
          <textarea
            id={`${id}-note`}
            className="input min-h-20 resize-y"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" disabled={busy || !reason}>Отправить жалобу</button>
      </form>
    </Modal>
  );
}
