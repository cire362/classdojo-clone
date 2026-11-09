import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { CaretDownIcon, CaretUpIcon, DotsSixVerticalIcon, MinusIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { Reason } from '../../../lib/api';
import { useToast } from '../../../ui/Toast';
import { Modal, PageTitle } from '../../../ui';
import { useGroup } from '../../groups';
import { createReason, deleteReason, saveReasonOrder, updateReason } from '../api';
import { cap } from '@heroes/shared/terms';
import { useTerms } from '../../auth';
import { Glyph } from '../../../ui/Glyph';
import { IconPicker } from '../../../ui/IconPicker';
import { REASON_ICONS } from '@heroes/shared/icons';


type Draft = { name: string; emoji: string; value: number; countsForHelpBadge: boolean };

export function ReasonsManager() {
  const t = useTerms();
  const { data, reload } = useGroup();
  const toast = useToast();
  const [editing, setEditing] = useState<Reason | 'new' | null>(null);
  const readOnly = !!data.group.archivedAt;
  // Локальный порядок: меняется сразу при перетаскивании, на сервер уходит после отпускания
  const [plus, setPlus] = useState<Reason[]>([]);
  const [minus, setMinus] = useState<Reason[]>([]);
  const latest = useRef({ plus, minus });
  latest.current = { plus, minus };

  useEffect(() => {
    setPlus(data.reasons.filter((r) => r.value > 0));
    setMinus(data.reasons.filter((r) => r.value < 0));
  }, [data.reasons]);

  async function saveOrder(next = latest.current) {
    const ids = [...next.plus, ...next.minus].map((r) => r.id);
    if (ids.join() === data.reasons.map((r) => r.id).join()) return;
    try {
      await saveReasonOrder(data.group.id, ids);
      await reload();
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      await reload();
    }
  }

  function move(kind: 'plus' | 'minus', index: number, delta: number) {
    const list = kind === 'plus' ? [...plus] : [...minus];
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    const next = kind === 'plus' ? { plus: list, minus } : { plus, minus: list };
    if (kind === 'plus') setPlus(list);
    else setMinus(list);
    void saveOrder(next);
  }

  async function remove(r: Reason) {
    try {
      await deleteReason(r.id);
      await reload();
      toast({ text: `«${r.name}» удалена. В истории ${t.student.many.gen} она останется`, tone: 'neutral' });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  const list = (kind: 'plus' | 'minus', items: Reason[], setItems: (r: Reason[]) => void) => (
    <Reorder.Group as="ul" axis="y" values={items} onReorder={setItems} className="card divide-y divide-line overflow-hidden">
      {items.map((r, i) => (
        <ReasonRow
          key={r.id}
          reason={r}
          readOnly={readOnly}
          first={i === 0}
          last={i === items.length - 1}
          onUp={() => move(kind, i, -1)}
          onDown={() => move(kind, i, 1)}
          onDrop={() => void saveOrder()}
          onEdit={() => setEditing(r)}
          onDelete={() => remove(r)}
        />
      ))}
    </Reorder.Group>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle
        actions={
          !readOnly && (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
              <PlusIcon size={18} weight="bold" /> Новая причина
            </button>
          )
        }
      >
        Причины начисления
      </PageTitle>
      <p className="max-w-[60ch] text-ink-soft">
        {readOnly && 'Группа в архиве, причины только для просмотра. '}
        Перетащите причину за ручку слева, чтобы поменять порядок: так же они будут стоять на экране урока. «Посещение» (+1)
        начисляется автоматически при отметке присутствующих и здесь не показывается.
      </p>
      <section className="space-y-3">
        <h3 className="text-base">Плюсы</h3>
        {plus.length ? list('plus', plus, setPlus) : <p className="text-ink-soft">Нет ни одной причины для плюсов.</p>}
      </section>
      <section className="space-y-3">
        <h3 className="text-base">Минусы</h3>
        {minus.length ? list('minus', minus, setMinus) : <p className="text-ink-soft">Минусов нет. Так тоже можно.</p>}
      </section>

      <ReasonModal
        reason={editing}
        onClose={() => setEditing(null)}
        onSave={async (draft) => {
          if (editing === 'new') await createReason(data.group.id, draft);
          else if (editing) await updateReason(editing.id, draft);
          setEditing(null);
          await reload();
        }}
      />
    </div>
  );
}

function ReasonRow({
  reason: r,
  readOnly,
  first,
  last,
  onUp,
  onDown,
  onDrop,
  onEdit,
  onDelete,
}: {
  reason: Reason;
  readOnly: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onDrop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const schoolLabel = cap(useTerms().org.one.nom);
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="li"
      value={r}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="relative flex items-center gap-2 bg-surface px-2 py-2.5 sm:gap-3 sm:px-3"
      whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-pop)', zIndex: 1 }}
    >
      {!readOnly && <button
        type="button"
        className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-ink-soft hover:bg-surface-2 active:cursor-grabbing"
        aria-label={`Перетащить «${r.name}»`}
        onPointerDown={(e) => controls.start(e)}
      >
        <DotsSixVerticalIcon size={22} weight="bold" />
      </button>}
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2" aria-hidden>
        <Glyph name={r.emoji} size={24} className={r.value > 0 ? 'text-plus' : 'text-minus'} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
      {r.school && <span className="chip bg-surface-2 text-ink-soft" title="Общая причина: её меняет администрация">{schoolLabel}</span>}
      <span className={`chip ${r.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>
        {r.value > 0 ? `+${r.value}` : `−${Math.abs(r.value)}`}
      </span>
      {!readOnly && <>
      <span className="hidden sm:flex">
        <button className="icon-btn size-9 disabled:opacity-30" aria-label={`Выше: «${r.name}»`} disabled={first} onClick={onUp}>
          <CaretUpIcon size={18} />
        </button>
        <button className="icon-btn size-9 disabled:opacity-30" aria-label={`Ниже: «${r.name}»`} disabled={last} onClick={onDown}>
          <CaretDownIcon size={18} />
        </button>
      </span>
      {!r.school && <>
      <button className="icon-btn" aria-label={`Изменить «${r.name}»`} onClick={onEdit}>
        <PencilSimpleIcon size={20} />
      </button>
      <button className="icon-btn hover:text-minus" aria-label={`Удалить «${r.name}»`} onClick={onDelete}>
        <TrashIcon size={20} />
      </button>
      </>}
      </>}
    </Reorder.Item>
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
  const [draft, setDraft] = useState<Draft>({ name: '', emoji: 'star', value: 1, countsForHelpBadge: false });
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const currentKey = reason === 'new' ? 'new' : reason?.id ?? null;
  if (currentKey !== key) {
    setKey(currentKey);
    setError(null);
    setDraft(
      reason && reason !== 'new'
        ? { name: reason.name, emoji: reason.emoji, value: reason.value, countsForHelpBadge: reason.countsForHelpBadge ?? false }
        : { name: '', emoji: 'star', value: 1, countsForHelpBadge: false },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave({ ...draft, countsForHelpBadge: draft.value > 0 && draft.countsForHelpBadge });
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
        <IconPicker options={REASON_ICONS} value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
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
        {draft.value > 0 && (
          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-ink" checked={draft.countsForHelpBadge} onChange={(e) => setDraft({ ...draft, countsForHelpBadge: e.target.checked })} aria-describedby="help-badge-hint" />
              Учитывать для значка «Надёжный друг»
            </label>
            <p id="help-badge-hint" className="mt-2 text-sm text-ink-soft">Каждое начисление — один случай помощи, независимо от числа баллов. Изменение действует на новые начисления.</p>
          </div>
        )}
        {error && <p className="text-sm font-medium text-minus">{error}</p>}
        <button className="btn btn-primary" disabled={!draft.name.trim()}>
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
