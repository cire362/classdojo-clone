import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowClockwiseIcon, BellIcon, CheckIcon, GiftIcon, MegaphoneIcon } from '@phosphor-icons/react';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { formatDateTime, pluralize, useLoad } from '../../../lib/hooks';
import { useNotifications } from '../../notifications';
import { fetchNotifications, markNotificationsRead } from '../api';
import { useTerms } from '../../auth';

export function StudentInbox() {
  const t = useTerms();
  const { counts, refresh } = useNotifications();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const revision = useRef(0);
  const { data, setData, loading, error, reload } = useLoad(async () => {
    revision.current++;
    const result = await fetchNotifications();
    void refresh();
    setMoreError(null);
    return result;
  }, [counts.feed, counts.rewards]);

  async function readAll() {
    if (!data) return;
    setBusy(true);
    try {
      await markNotificationsRead(data.groupId, data.through);
      await reload();
      toast({ text: 'Уведомления отмечены прочитанными', tone: 'ok' });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function more() {
    if (!data?.nextCursor) return;
    const current = revision.current;
    setBusy(true);
    setMoreError(null);
    try {
      const query = new URLSearchParams({ before: data.nextCursor, through: data.through });
      const next = await fetchNotifications(String(query));
      if (current !== revision.current) return;
      // Перевод во время просмотра меняет ленту — смешивать записи двух групп нельзя.
      if (next.groupId !== data.groupId) await reload();
      else setData((visible) => visible === data ? { ...next, items: [...data.items, ...next.items] } : visible);
    } catch (e) {
      if (current === revision.current) setMoreError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Уведомления</h1>
          <p className="mt-2 text-ink-soft">Новости {t.group.one.gen} и выданные награды.</p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={busy || loading} onClick={() => void reload()}>
          <ArrowClockwiseIcon size={18} aria-hidden /> Обновить
        </button>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p role="status" className="text-sm text-ink-soft">{data.unreadCount > 0 ? `${data.unreadCount} ${pluralize(data.unreadCount, 'непрочитанное уведомление', 'непрочитанных уведомления', 'непрочитанных уведомлений')}` : 'Всё прочитано'}</p>
          <button className="btn btn-ghost btn-sm" disabled={busy || loading || data.unreadCount === 0} onClick={() => void readAll()}>
            <CheckIcon size={18} aria-hidden /> Прочитать все
          </button>
        </div>
        {data.items.length === 0 ? <EmptyState icon={<BellIcon size={28} />} title="Пока тихо">
          Когда преподаватель выдаст награду или напишет в ленту {t.group.one.gen}, уведомление появится здесь.
        </EmptyState> : <ul className="divide-y divide-line" aria-label={`Уведомления ${t.student.one.gen}`}>
          {data.items.map((item) => {
            const Icon = item.kind === 'reward' ? GiftIcon : MegaphoneIcon;
            return <li key={item.id} className="flex gap-3 py-5 sm:gap-4">
              <span className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full ${item.unread ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-soft'}`}><Icon size={22} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="font-sans text-base font-semibold">{item.title}</h2>
                  {item.unread && <span className="chip bg-accent/25 text-xs text-ink">Новое</span>}
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-line break-words">{item.text}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft"><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>{item.author && ` · ${item.author}`}{item.cost !== null && ` · ${item.cost} ${pluralize(item.cost, 'балл', 'балла', 'баллов')}`}</p>
                <Link className="btn btn-ghost btn-sm -ml-3 mt-2" to={item.href}>
                  {item.kind === 'reward' ? 'К наградам' : `В ленту ${t.group.one.gen}`}
                </Link>
              </div>
            </li>;
          })}
        </ul>}
        {moreError && <p role="alert" className="text-sm text-minus">{moreError}</p>}
        {data.nextCursor && <button className="btn btn-secondary" disabled={busy || loading} onClick={() => void more()}>Показать ещё</button>}
      </>}
    </div>
  );
}
