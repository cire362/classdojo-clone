import { useState, type FormEvent } from 'react';
import { PlusIcon, TrashIcon, TrophyIcon } from '@phosphor-icons/react';
import type { PortfolioItem } from '../api';
import { formatDate } from '../hooks';
import { useToast } from './Toast';
import { EmptyState } from './ui';

export interface PortfolioEdit {
  add: (item: { title: string; description: string; emoji: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const EMOJI = ['🏆', '🥇', '🥈', '🥉', '🎓', '📚', '🔬', '🎨', '🎭', '🎵', '⚽', '💡'];

/** Портфолио ученика: достижения, которые записывает преподаватель. edit — только у преподавателя */
export function Portfolio({ items, edit }: { items: PortfolioItem[]; edit?: PortfolioEdit }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', emoji: EMOJI[0] });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await edit.add({ ...form, title: form.title.trim(), description: form.description.trim() });
      setForm({ title: '', description: '', emoji: EMOJI[0] });
      setOpen(false);
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {edit &&
        (open ? (
          <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line p-4">
            <fieldset>
              <legend className="label">Значок</legend>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI.map((em) => (
                  <button
                    key={em}
                    type="button"
                    aria-pressed={form.emoji === em}
                    aria-label={`Значок ${em}`}
                    className={`flex size-10 items-center justify-center rounded-xl text-xl ${form.emoji === em ? 'bg-accent/30 ring-2 ring-ink' : 'bg-surface-2'}`}
                    onClick={() => setForm({ ...form, emoji: em })}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="portfolio-title">
                Достижение
              </label>
              <input id="portfolio-title" className="input" maxLength={100} placeholder="Например, призёр олимпиады по математике" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="portfolio-description">
                Подробности (необязательно)
              </label>
              <textarea id="portfolio-description" className="input min-h-20 resize-y" maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={busy || !form.title.trim()}>
                Добавить в портфолио
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-secondary" onClick={() => setOpen(true)}>
            <PlusIcon size={18} weight="bold" /> Записать достижение
          </button>
        ))}
      {items.length === 0 ? (
        <EmptyState icon={<TrophyIcon size={28} />} title="Записей преподавателя пока нет">
          {edit ? 'Олимпиады, проекты, выступления — всё, чем ученик может гордиться.' : 'Здесь появятся достижения, которые отметит преподаватель.'}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <li key={it.id} className="card flex gap-3 p-4">
              <span className="text-3xl leading-none" aria-hidden>
                {it.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{it.title}</div>
                {it.description && <p className="mt-1 whitespace-pre-line break-words text-sm">{it.description}</p>}
                <div className="mt-2 text-xs text-ink-soft">
                  {formatDate(it.createdAt.slice(0, 10))}
                  {it.author && ` · ${it.author}`}
                </div>
              </div>
              {edit && (
                <button className="icon-btn -mr-2 -mt-2 shrink-0" title="Удалить" aria-label={`Удалить «${it.title}»`} onClick={() => void edit.remove(it.id)}>
                  <TrashIcon size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
