import { useState, type FormEvent } from 'react';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { SchoolReason } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { addSchoolReason, deleteSchoolReason, fetchSchoolReasons, updateSchoolReason } from '../api';

const VALUES = [5, 4, 3, 2, 1, -1, -2, -3, -4, -5];
const EMPTY = { name: '', emoji: '⭐', value: 1 };
const signed = (v: number) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);

/**
 * Общие причины школы: появляются в списке причин каждого класса с отметкой «Школа».
 * Преподаватель начисляет по ним как обычно, но изменить или удалить их может только администрация
 */
export function SchoolReasons({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => fetchSchoolReasons(), []);
  const [editing, setEditing] = useState<SchoolReason | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<SchoolReason[]>, done: string) {
    setBusy(true);
    try {
      setData(await action());
      setEditing(null);
      toast({ text: done, tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  const open = (r: SchoolReason | 'new') => {
    setForm(r === 'new' ? EMPTY : { name: r.name, emoji: r.emoji, value: r.value });
    setEditing(r);
  };
  function save(e: FormEvent) {
    e.preventDefault();
    const data = { ...form, name: form.name.trim(), emoji: form.emoji.trim() };
    const request = editing === 'new' ? () => addSchoolReason(data) : () => updateSchoolReason((editing as SchoolReason).id, data);
    void run(request, 'Причина сохранена во всех классах');
  }

  return (
    <section className="space-y-3" aria-labelledby="school-reasons-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="school-reasons-title" className="text-lg">Общие причины</h2>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => open('new')}>
            <PlusIcon size={18} aria-hidden /> Добавить причину
          </button>
        )}
      </div>
      <p className="text-sm text-ink-soft">Появляются в каждом классе школы с отметкой «Школа». Изменить их может только администрация.</p>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-24" />}
      {data && data.length === 0 && <p className="text-ink-soft">Общих причин пока нет.</p>}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden" aria-label="Общие причины школы">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl" aria-hidden>
                {r.emoji}
              </span>
              <span className="min-w-0 flex-1 break-words font-medium">{r.name}</span>
              <span className={`chip ${r.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>{signed(r.value)}</span>
              {canEdit && (
                <>
                  <button className="icon-btn" aria-label={`Изменить «${r.name}»`} onClick={() => open(r)}>
                    <PencilSimpleIcon size={20} />
                  </button>
                  <button
                    className="icon-btn hover:text-minus"
                    aria-label={`Удалить «${r.name}»`}
                    disabled={busy}
                    onClick={() => run(() => deleteSchoolReason(r.id), 'Причина убрана из всех классов')}
                  >
                    <TrashIcon size={20} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!editing}
        title={editing === 'new' ? 'Новая общая причина' : 'Изменить общую причину'}
        onClose={() => { if (!busy) setEditing(null); }}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <div>
              <label className="label" htmlFor="school-reason-emoji">Значок</label>
              <input
                id="school-reason-emoji"
                className="input text-center text-2xl"
                maxLength={16}
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="school-reason-name">Название</label>
              <input
                id="school-reason-name"
                className="input"
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="school-reason-value">Баллы</label>
            <select
              id="school-reason-value"
              className="input"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            >
              {VALUES.map((v) => <option key={v} value={v}>{signed(v)}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.emoji.trim()}>Сохранить</button>
        </form>
      </Modal>
    </section>
  );
}
