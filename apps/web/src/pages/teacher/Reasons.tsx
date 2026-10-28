import { useState, type FormEvent } from 'react';
import { MinusIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { api, type Reason } from '../../api';
import { useToast } from '../../components/Toast';
import { Modal, PageTitle } from '../../components/ui';
import { useGroup } from './GroupLayout';

const EMOJI = ['💪', '💡', '🤝', '🧩', '✨', '⭐', '🏆', '📚', '🎯', '🚀', '🎨', '🙋', '⏰', '💤', '📕', '📢', '📱', '🙊'];

type Draft = { name: string; emoji: string; value: number };

export function ReasonsPage() {
  const { data, reload } = useGroup();
  const toast = useToast();
  const [editing, setEditing] = useState<Reason | 'new' | null>(null);

  const plus = data.reasons.filter((r) => r.value > 0);
  const minus = data.reasons.filter((r) => r.value < 0);

  async function remove(r: Reason) {
    try {
      await api('DELETE', `/teacher/reasons/${r.id}`);
      await reload();
      toast({ text: `«${r.name}» удалена. В истории учеников она останется`, tone: 'neutral' });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  const list = (items: Reason[]) => (
    <ul className="card divide-y divide-line overflow-hidden">
      {items.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl" aria-hidden>
            {r.emoji}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
          <span className={`chip ${r.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>
            {r.value > 0 ? `+${r.value}` : `−${Math.abs(r.value)}`}
          </span>
          <button className="icon-btn" aria-label={`Изменить «${r.name}»`} onClick={() => setEditing(r)}>
            <PencilSimpleIcon size={20} />
          </button>
          <button className="icon-btn hover:text-minus" aria-label={`Удалить «${r.name}»`} onClick={() => remove(r)}>
            <TrashIcon size={20} />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <PlusIcon size={18} weight="bold" /> Новая причина
          </button>
        }
      >
        Причины начисления
      </PageTitle>
      <p className="max-w-[60ch] text-ink-soft">
        «Посещение» (+1) начисляется автоматически при отметке присутствующих и здесь не показывается.
      </p>
      <section className="space-y-3">
        <h3 className="text-base">Плюсы</h3>
        {plus.length ? list(plus) : <p className="text-ink-soft">Нет ни одной причины для плюсов.</p>}
      </section>
      <section className="space-y-3">
        <h3 className="text-base">Минусы</h3>
        {minus.length ? list(minus) : <p className="text-ink-soft">Минусов нет. Так тоже можно.</p>}
      </section>

      <ReasonModal
        reason={editing}
        onClose={() => setEditing(null)}
        onSave={async (draft) => {
          if (editing === 'new') await api('POST', `/teacher/groups/${data.group.id}/reasons`, draft);
          else if (editing) await api('PATCH', `/teacher/reasons/${editing.id}`, draft);
          setEditing(null);
          await reload();
        }}
      />
    </div>
  );
}

function ReasonModal({
  reason,
  onClose,
  onSave,
}: {
  reason: Reason | 'new' | null;
  onClose: () => void;
  onSave: (d: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>({ name: '', emoji: '⭐', value: 1 });
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const currentKey = reason === 'new' ? 'new' : reason?.id ?? null;
  if (currentKey !== key) {
    setKey(currentKey);
    setError(null);
    setDraft(reason && reason !== 'new' ? { name: reason.name, emoji: reason.emoji, value: reason.value } : { name: '', emoji: '⭐', value: 1 });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave(draft);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal open={!!reason} title={reason === 'new' ? 'Новая причина' : 'Изменить причину'} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="reason-name">
            Название
          </label>
          <input
            id="reason-name"
            className="input"
            value={draft.name}
            maxLength={60}
            placeholder="Например, Выступил у доски"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <fieldset>
          <legend className="label">Значок</legend>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI.map((em) => (
              <button
                type="button"
                key={em}
                onClick={() => setDraft({ ...draft, emoji: em })}
                aria-pressed={draft.emoji === em}
                className={`flex size-11 items-center justify-center rounded-xl text-2xl transition ${
                  draft.emoji === em ? 'bg-accent' : 'bg-surface-2 hover:bg-line'
                }`}
              >
                {em}
              </button>
            ))}
            <input
              aria-label="Свой эмодзи"
              className="input h-11 w-20 px-2 text-center text-xl"
              value={EMOJI.includes(draft.emoji) ? '' : draft.emoji}
              placeholder="свой"
              onChange={(e) => setDraft({ ...draft, emoji: e.target.value.trim() || '⭐' })}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Баллы</legend>
          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-secondary size-11 px-0" aria-label="Меньше" onClick={() => setDraft({ ...draft, value: draft.value - 1 === 0 ? -1 : Math.max(-10, draft.value - 1) })}>
              <MinusIcon size={18} weight="bold" />
            </button>
            <span className={`chip min-w-16 justify-center py-1.5 text-lg ${draft.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>
              {draft.value > 0 ? `+${draft.value}` : `−${Math.abs(draft.value)}`}
            </span>
            <button type="button" className="btn btn-secondary size-11 px-0" aria-label="Больше" onClick={() => setDraft({ ...draft, value: draft.value + 1 === 0 ? 1 : Math.min(10, draft.value + 1) })}>
              <PlusIcon size={18} weight="bold" />
            </button>
          </div>
        </fieldset>
        {error && <p className="text-sm font-medium text-minus">{error}</p>}
        <button className="btn btn-primary" disabled={!draft.name.trim()}>
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
