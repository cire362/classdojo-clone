import { GiftIcon, StarIcon } from '@phosphor-icons/react';
import { api, type Shop } from '../../api';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorBox, Skeleton } from '../../components/ui';
import { formatDateTime, pluralize, useLoad } from '../../hooks';
import { useNotifications } from '../../notify';

const STATUS = {
  PENDING: { text: 'ждёт ответа учителя', cls: 'bg-accent/25 text-ink' },
  APPROVED: { text: 'получено', cls: 'bg-plus-bg text-plus' },
  REJECTED: { text: 'отказано, баллы вернулись', cls: 'bg-surface-2 text-ink-soft' },
} as const;

/** Магазин наград ученика: тратит баллы на награды класса */
export function ShopPage() {
  const toast = useToast();
  const { refresh } = useNotifications();
  const { data, setData, error, reload } = useLoad(async () => {
    const shop = await api<Shop>('GET', '/student/shop');
    void refresh();
    return shop;
  }, []);

  async function act(fn: () => Promise<Shop>, ok: string) {
    try {
      setData(await fn());
      toast({ text: ok, tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Награды</h1>
          <p className="mt-2 text-ink-soft">Трать баллы на награды класса. Уровень героя от этого не уменьшится.</p>
        </div>
        <div className="card flex items-center gap-2 px-5 py-3">
          <StarIcon size={24} weight="fill" className="text-accent" aria-hidden />
          <span className="font-display text-2xl tabular-nums">{data.balance}</span>
          <span className="text-ink-soft">можно потратить</span>
        </div>
      </div>

      {data.rewards.length === 0 ? (
        <EmptyState icon={<GiftIcon size={28} />} title="Наград пока нет">
          Когда учитель добавит награды, они появятся здесь.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.rewards.map((r) => {
            const short = r.cost - data.balance;
            return (
              <li key={r.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none" aria-hidden>
                    {r.emoji}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold">{r.title}</span>
                  <span className="chip bg-accent/25 text-ink">
                    {r.cost}
                    <span className="sr-only"> {pluralize(r.cost, 'балл', 'балла', 'баллов')}</span>
                  </span>
                </div>
                <button
                  className="btn btn-primary btn-sm mt-auto"
                  disabled={data.archived || short > 0}
                  onClick={() => act(() => api<Shop>('POST', `/student/shop/${r.id}/request`), 'Запрос отправлен учителю')}
                >
                  {short > 0 ? `Не хватает ${short}` : 'Попросить'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data.requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg">Мои запросы</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {data.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="text-xl" aria-hidden>
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {formatDateTime(r.createdAt)} · {r.cost} {pluralize(r.cost, 'балл', 'балла', 'баллов')}
                  </span>
                </span>
                <span className={`chip text-xs ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span>
                {r.status === 'PENDING' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => act(() => api<Shop>('DELETE', `/student/shop/requests/${r.id}`), 'Запрос отменён, баллы вернулись')}>
                    Отменить
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
