import { useMemo, useState } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import { pluralize } from '../hooks';
import { Modal, Toggle } from './ui';

export interface ImportPreview {
  names: { name: string; alreadyInGroup: boolean }[];
  skipped: number;
  source: string;
}

/** «Иванова Мария Петровна» → «Мария Иванова» (по выбранным настройкам) */
export function formatName(name: string, swap: boolean, dropPatronymic: boolean): string {
  const words = name.split(' ');
  if (words.length < 2) return name;
  let [first, second, ...rest] = words;
  if (swap) [first, second] = [second, first];
  if (dropPatronymic && rest.length) rest = rest.slice(1);
  return [first, second, ...rest].join(' ');
}

export function ImportStudentsModal({
  preview,
  busy,
  onClose,
  onConfirm,
}: {
  preview: ImportPreview | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (names: string[]) => void;
}) {
  const [key, setKey] = useState<ImportPreview | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [swap, setSwap] = useState(false);
  const [dropPatronymic, setDropPatronymic] = useState(false);

  // Новый файл: отмечаем всех, кроме уже добавленных; для «ФИО» сразу предлагаем «Имя Фамилия»
  if (preview && preview !== key) {
    setKey(preview);
    setChecked(new Set(preview.names.map((n, i) => (n.alreadyInGroup ? -1 : i)).filter((i) => i >= 0)));
    const threeWords = preview.names.filter((n) => n.name.split(' ').length >= 3).length;
    const fio = threeWords > preview.names.length / 2;
    setSwap(fio);
    setDropPatronymic(fio);
  }

  const names = useMemo(
    () => preview?.names.map((n) => formatName(n.name, swap, dropPatronymic)) ?? [],
    [preview, swap, dropPatronymic],
  );
  const hasPatronymic = preview?.names.some((n) => n.name.split(' ').length >= 3) ?? false;
  const selected = [...checked].sort((a, b) => a - b).map((i) => names[i]);

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <Modal open={!!preview} title="Ученики из файла" onClose={onClose} size="lg">
      {preview && (
        <div className="space-y-5">
          <p className="text-ink-soft">
            Найдено {preview.names.length} {pluralize(preview.names.length, 'имя', 'имени', 'имён')} ({preview.source})
            {preview.skipped > 0 && `, пропущено строк: ${preview.skipped}`}. Снимите отметку с лишних.
          </p>

          <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
            <Toggle checked={swap} onChange={setSwap} label="Сначала имя, потом фамилия" hint="Для списков вида «Иванова Мария»" />
            {hasPatronymic && <Toggle checked={dropPatronymic} onChange={setDropPatronymic} label="Без отчества" />}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold tabular-nums">
              Выбрано {checked.size} из {names.length}
            </span>
            <span className="flex gap-1">
              <button className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set(names.map((_, i) => i)))}>
                Все
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set())}>
                Никого
              </button>
            </span>
          </div>

          <ul className="card max-h-[45dvh] divide-y divide-line overflow-y-auto">
            {names.map((name, i) => {
              const on = checked.has(i);
              const dup = preview.names[i].alreadyInGroup;
              return (
                <li key={i}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-surface-2">
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(i)} />
                    <span
                      aria-hidden
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                        on ? 'border-ink bg-accent text-on-accent' : 'border-line bg-surface'
                      }`}
                    >
                      {on && <CheckIcon size={14} weight="bold" />}
                    </span>
                    <span className={`flex-1 ${on ? 'font-medium' : 'text-ink-soft'}`}>{name}</span>
                    {dup && <span className="chip bg-surface-2 text-xs text-ink-soft">уже в группе</span>}
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || selected.length === 0} onClick={() => onConfirm(selected)}>
              {busy ? 'Добавляем…' : `Добавить ${selected.length}`}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
