import { useId, useState } from 'react';
import { EyeIcon, EyeSlashIcon, FlagIcon, ListBulletsIcon } from '@phosphor-icons/react';
import { REPORT_REASONS, type ReportReason } from '@heroes/shared';
import type { ModerationActionKind, ReportedItem } from '../../../lib/api';
import { formatDateTime, pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { fetchModeration, setHidden } from '../api';

const ACTIONS: Record<ModerationActionKind, string> = {
  report: 'Жалоба',
  hide: 'Скрыто',
  auto_hide: 'Скрыто по жалобам',
  unhide: 'Возвращено',
  keep: 'Оставлено после жалоб',
  delete: 'Удалено',
};
const TARGETS = { post: 'запись', comment: 'комментарий' } as const;

/**
 * Жалобы родителей на записи и комментарии группы и журнал действий. version меняется, когда ленту
 * поправили в другом месте; onDecided сообщает ленте, что её пора перечитать.
 */
export function ModerationPanel({ groupId, version, onDecided }: { groupId: string; version: number; onDecided: () => void }) {
  const id = useId();
  const toast = useToast();
  const { data, setData, error, reload } = useLoad(() => fetchModeration(groupId), [groupId, version]);
  const [logOpen, setLogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function decide(item: ReportedItem, hidden: boolean) {
    setBusy(true);
    try {
      setData(await setHidden(groupId, item.target, item.id, hidden));
      onDecided();
      toast({ text: hidden ? 'Скрыто от учеников и родителей' : 'Оставлено в ленте', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button className="btn btn-secondary btn-sm" onClick={() => setLogOpen(true)}>
        <ListBulletsIcon size={18} aria-hidden /> Журнал модерации
      </button>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.reports.length > 0 && (
        <section className="card space-y-3 p-4" aria-labelledby={`${id}-title`}>
          <h2 id={`${id}-title`} className="flex items-center gap-2 font-display text-lg">
            <FlagIcon size={20} weight="fill" className="text-minus" aria-hidden />
            Жалобы родителей: {data.reports.length}
          </h2>
          <ul className="divide-y divide-line">
            {data.reports.map((item) => (
              <li key={`${item.target}:${item.id}`} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="text-sm text-ink-soft">
                  {item.target === 'post' ? 'Запись' : 'Комментарий'} · <span className="font-semibold text-ink">{item.author}</span>
                  {' · '}
                  {formatDateTime(item.createdAt)}
                  {item.hidden && <span className="chip ml-2 bg-minus-bg text-xs text-minus">Скрыто до решения</span>}
                </div>
                <p className="line-clamp-4 whitespace-pre-line break-words">{item.text || 'Без текста, только фото или видео'}</p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Причины">
                  {(Object.entries(item.reasons) as [ReportReason, number][]).map(([reason, count]) => (
                    <li key={reason} className="chip bg-surface-2 text-xs text-ink">
                      {REPORT_REASONS[reason]}: {count}
                    </li>
                  ))}
                </ul>
                {item.notes.length > 0 && (
                  <ul className="space-y-1 text-sm" aria-label="Пояснения родителей">
                    {item.notes.map((note, i) => (
                      <li key={i} className="border-l-2 border-line pl-2 text-ink-soft">{note}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide(item, true)}>
                    <EyeSlashIcon size={18} aria-hidden /> {item.hidden ? 'Оставить скрытым' : 'Скрыть'}
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => decide(item, false)}>
                    <EyeIcon size={18} aria-hidden /> {item.hidden ? 'Вернуть в ленту' : 'Оставить'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Modal open={logOpen} title="Журнал модерации" size="lg" onClose={() => setLogOpen(false)}>
        {data && data.log.length === 0 && <p className="text-sm text-ink-soft">Жалоб, скрытий и удалений пока не было.</p>}
        {data && data.log.length > 0 && (
          <>
            <p className="mb-3 text-sm text-ink-soft">
              Последние {data.log.length} {pluralize(data.log.length, 'действие', 'действия', 'действий')}.
              {' '}Текст сохранён коротким отрывком.
            </p>
            <ol className="divide-y divide-line">
              {data.log.map((entry) => (
                <li key={entry.id} className="py-2 text-sm">
                  <div className="text-ink-soft">
                    <span className="font-semibold text-ink">{ACTIONS[entry.action]}</span> · {TARGETS[entry.target]} · {entry.actor}
                    {' · '}
                    {formatDateTime(entry.createdAt)}
                  </div>
                  <p className="break-words">{entry.excerpt}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </Modal>
    </div>
  );
}
