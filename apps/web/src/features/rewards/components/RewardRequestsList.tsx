import { Link } from 'react-router-dom';
import { ArrowClockwiseIcon, ArrowRightIcon, GiftIcon } from '@phosphor-icons/react';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { pluralize, useLoad } from '../../../lib/hooks';
import { useNotifications } from '../../notifications';
import { fetchPendingRequests } from '../api';
import { useTerms } from '../../auth';

/** Общая очередь: переходим в нужную группу, чтобы выдать награду или отказать. */
export function RewardRequestsList() {
  const t = useTerms();
  const { counts, refresh } = useNotifications();
  // Каждый успешный опрос счётчиков обновляет и распределение по группам, даже если сумма та же.
  const { data, error, loading, reload } = useLoad(() => fetchPendingRequests(), [counts]);
  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl">Запросы наград</h1>
          <p className="mt-2 text-ink-soft">Действующие группы, где вы ведёте занятия, в том числе вместе с другими преподавателями.</p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={loading} onClick={() => { void reload(); void refresh(); }}>
          <ArrowClockwiseIcon size={18} aria-hidden /> Обновить
        </button>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : !data ? (
        <div role="status" aria-label="Загрузка запросов"><Skeleton className="h-40" /></div>
      ) : (
        <>
          <p role="status" className="text-sm text-ink-soft">
            {data.total > 0 ? `${data.total} ${pluralize(data.total, 'запрос ждёт', 'запроса ждут', 'запросов ждут')} ответа. Выберите группу, чтобы выдать награду или отказать.` : 'Все запросы рассмотрены.'}
          </p>
          {data.groups.length === 0 ? (
            <EmptyState icon={<GiftIcon size={28} aria-hidden />} title="Ожидающих запросов нет">
              Когда {t.student.one.nom} попросит награду, здесь появится его группа.
              Запросы групп в архиве доступны после восстановления группы.
            </EmptyState>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {data.groups.map((g) => (
                <li key={g.id}>
                  <Link to={`/g/${g.id}/rewards`} className="flex min-h-20 items-center gap-4 px-4 py-4 transition hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-semibold">{g.name}</span>
                      <span className="mt-1 block text-sm text-ink-soft">{g.count} {pluralize(g.count, 'запрос ждёт', 'запроса ждут', 'запросов ждут')} ответа</span>
                    </span>
                    <ArrowRightIcon size={20} className="shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
