import { useEffect, useRef, useState } from 'react';
import { ArrowClockwiseIcon, GiftIcon } from '@phosphor-icons/react';
import { api, type ParentRewards as Rewards, type RewardRequest } from '../../../lib/api';
import { formatDateTime, points, useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';

const STATUS = {
  PENDING: { text: 'Ждёт ответа', cls: 'bg-accent/25 text-ink' },
  APPROVED: { text: 'Выдано', cls: 'bg-plus-bg text-plus' },
  REJECTED: { text: 'Отказано', cls: 'bg-surface-2 text-ink-soft' },
} as const;

function RequestList({ requests }: { requests: RewardRequest[] }) {
  return <ul className="card divide-y divide-line overflow-hidden">
    {requests.map((r) => <li key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-4">
      <span className="text-2xl leading-none" aria-hidden>{r.emoji}</span>
      <div className="min-w-0 flex-1 basis-40">
        <span className="block break-words font-semibold">{r.title}</span>
        <span className="mt-1 block text-sm text-ink-soft">{points(r.cost)} · Запрос {formatDateTime(r.createdAt)}</span>
        {r.decidedAt && <span className="mt-1 block text-xs text-ink-soft">Ответ {formatDateTime(r.decidedAt)}</span>}
        {r.status === 'REJECTED' && <span className="mt-1 block text-sm text-ink-soft">Баллы возвращены.</span>}
      </div>
      <span className={`chip shrink-0 text-xs ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span>
    </li>)}
  </ul>;
}

/** Решения в истории окончательны, поэтому обновление не сворачивает уже открытые страницы */
function keepOpenedHistory(fresh: Rewards, shown: Rewards | null): Rewards {
  if (!shown || shown.student.id !== fresh.student.id || shown.history.length <= fresh.history.length) return fresh;
  const byId = new Map([...shown.history, ...fresh.history].map((r) => [r.id, r]));
  const history = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return { ...fresh, history, nextCursor: shown.nextCursor };
}

/** Только просмотр своего ребёнка: никакой выдачи, отмены или прочтения уведомлений за ученика. */
export function ParentRewards({ childId }: { childId: string }) {
  const version = useRef(0);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const path = `/parent/children/${childId}/rewards`;
  const shown = useRef<Rewards | null>(null);
  const { data, setData, loading, error, reload } = useLoad(async () => {
    version.current++;
    setMoreError(null);
    setMoreLoading(false);
    return keepOpenedHistory(await api<Rewards>('GET', path), shown.current);
  }, [path]);
  shown.current = data;

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void reload(); };
    const timer = window.setInterval(onVisible, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { version.current++; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [reload]);

  async function more() {
    if (!data?.nextCursor || moreLoading || loading) return;
    const current = version.current;
    setMoreLoading(true);
    setMoreError(null);
    try {
      const next = await api<Rewards>('GET', `${path}?${new URLSearchParams({ before: data.nextCursor })}`);
      if (current !== version.current) return;
      setData((old) => old && old.student.id === next.student.id ? {
        ...old, history: [...new Map([...old.history, ...next.history].map((r) => [r.id, r])).values()], nextCursor: next.nextCursor,
      } : old);
    } catch (e) {
      if (current === version.current) setMoreError((e as Error).message);
    } finally {
      if (current === version.current) setMoreLoading(false);
    }
  }

  return <section className="max-w-3xl space-y-6" aria-label="Награды ребёнка">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl">Награды</h1>
        {data?.student.id === childId && <p className="mt-2 break-words text-ink-soft">{data.student.name}, {data.student.groupName}</p>}
      </div>
      <button className="btn btn-secondary btn-sm" disabled={loading} onClick={() => void reload()}><ArrowClockwiseIcon size={18} aria-hidden /> Обновить</button>
    </div>
    {error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.student.id !== childId ? (
      <div role="status" aria-label="Загрузка наград"><Skeleton className="h-60" /></div>
    ) : <>
      <div className="space-y-2">
        <p className="font-semibold">Баланс для наград: <span className="tabular-nums">{points(data.balance)}</span></p>
        <p className="text-sm text-ink-soft">Запросы отправляет и отменяет ребёнок из своего кабинета. Баллы ожидающих и выданных наград уже учтены в балансе; уровень героя от трат не снижается.</p>
        {data.archived && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">Группа в архиве. Награды и история доступны для просмотра; новые запросы и выдача приостановлены.</p>}
      </div>
      <div className="space-y-3">
        <h2 className="text-lg">Ожидают ответа ({data.pending.length})</h2>
        {data.pending.length ? <RequestList requests={data.pending} /> : <p className="text-sm text-ink-soft">Ожидающих запросов нет.</p>}
      </div>
      <div className="space-y-3">
        <h2 className="text-lg">История наград</h2>
        {data.history.length ? <>
          <p className="text-sm text-ink-soft">Выданные награды и отказы, сначала последние запросы.</p>
          <RequestList requests={data.history} />
        </> : <EmptyState icon={<GiftIcon size={28} aria-hidden />} title="Решений пока нет">Когда преподаватель выдаст награду или ответит отказом, решение появится здесь.</EmptyState>}
        {moreError && <p role="alert" className="text-sm text-minus">{moreError}</p>}
        {data.nextCursor && <button className="btn btn-secondary" disabled={moreLoading || loading} onClick={() => void more()}>{moreLoading ? 'Загружаем…' : 'Показать ещё'}</button>}
      </div>
      <details className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer font-semibold">Награды группы ({data.rewards.length})</summary>
        {data.rewards.length ? <ul className="mt-3 divide-y divide-line">
          {data.rewards.map((r) => <li key={r.id} className="flex items-start gap-3 py-3">
            <span aria-hidden className="text-xl">{r.emoji}</span>
            <span className="min-w-0 flex-1 break-words font-medium">{r.title}</span>
            <span className="shrink-0 text-sm text-ink-soft">{points(r.cost)}</span>
          </li>)}
        </ul> : <p className="mt-3 text-sm text-ink-soft">Преподаватель пока не добавил награды для этой группы.</p>}
      </details>
    </>}
  </section>;
}
