import { useState, type FormEvent } from 'react';
import { PlusIcon, TrashIcon, TrophyIcon } from '@phosphor-icons/react';
import type { PortfolioItem } from '../../../lib/api';
import { formatDate } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import { EmptyState } from '../../../ui';
import { useTerms } from '../../auth';
import { Glyph } from '../../../ui/Glyph';
import { IconPicker } from '../../../ui/IconPicker';
import { PORTFOLIO_ICONS } from '@heroes/shared/icons';

export interface PortfolioEdit {
  add: (item: { title: string; description: string; emoji: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}


/** Портфолио ученика: достижения, которые записывает преподаватель. edit — только у преподавателя */
export function Portfolio({ items, edit }: { items: PortfolioItem[]; edit?: PortfolioEdit }) {
  const t = useTerms();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', emoji: PORTFOLIO_ICONS[0] });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await edit.add({ ...form, title: form.title.trim(), description: form.description.trim() });
      setForm({ title: '', description: '', emoji: PORTFOLIO_ICONS[0] });
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
            <IconPicker options={PORTFOLIO_ICONS} value={form.emoji} onChange={(emoji) => setForm({ ...form, emoji })} />
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
          {edit
            ? `Олимпиады, проекты, выступления — всё, чем ${t.student.one.nom} может гордиться.`
            : 'Здесь появятся достижения, которые отметит преподаватель.'}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <li key={it.id} className="card flex gap-3 p-4">
              <Glyph name={it.emoji} size={30} className="text-accent" />
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
