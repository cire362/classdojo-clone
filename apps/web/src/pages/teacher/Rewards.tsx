import { useState, type FormEvent } from 'react';
import { CheckIcon, GiftIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { api, type Reward, type RewardRequest } from '../../api';
import { useToast } from '../../ui/Toast';
import { EmptyState, ErrorBox, PageTitle, Skeleton } from '../../ui';
import { formatDateTime, pluralize, useLoad } from '../../hooks';
import { useGroup } from './GroupLayout';
import { useNotifications } from '../../notify';

const EMOJI = ['🎁', '🪑', '🎵', '🧑‍🏫', '⏰', '🎮', '🍬', '📖', '🎨', '⚽', '🌟', '🏅'];
const STATUS = { PENDING: 'ждёт ответа', APPROVED: 'выдано', REJECTED: 'отказано' } as const;

/** Магазин наград группы: запросы учеников и список наград */
export function RewardsPage() {
  const { data: group, reload: reloadGroup } = useGroup();
  const toast = useToast();
  const { refresh } = useNotifications();
  const archived = !!group.group.archivedAt;
  const { data, setData, error, reload } = useLoad(
    () => api<{ rewards: Reward[]; requests: RewardRequest[] }>('GET', `/teacher/groups/${group.group.id}/rewards`),
    [group.group.id],
  );
  const [form, setForm] = useState({ title: '', emoji: EMOJI[0], cost: 10 });
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const decide = (r: RewardRequest, approve: boolean) =>
    run(async () => {
      const requests = await api<RewardRequest[]>('POST', `/teacher/reward-requests/${r.id}/${approve ? 'approve' : 'reject'}`);
      setData({ ...data!, requests });
      void reloadGroup();
      void refresh();
      toast({ text: approve ? `${r.student?.name}: «${r.title}» выдано` : 'Отказано, баллы вернулись ученику', tone: approve ? 'ok' : 'neutral' });
    });

  const add = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const rewards = await api<Reward[]>('POST', `/teacher/groups/${group.group.id}/rewards`, { ...form, title: form.title.trim() });
      setData({ ...data!, rewards });
      setForm({ title: '', emoji: EMOJI[0], cost: 10 });
    });
  };

  const remove = (r: Reward) =>
    run(async () => {
      const rewards = await api<Reward[]>('DELETE', `/teacher/rewards/${r.id}`);
      setData({ ...data!, rewards });
    });

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-64" />;
  const pending = data.requests.filter((r) => r.status === 'PENDING');
  const done = data.requests.filter((r) => r.status !== 'PENDING').slice(0, 20);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="min-w-0 space-y-4">
        <PageTitle>Запросы учеников</PageTitle>
        {pending.length === 0 ? (
          <EmptyState icon={<GiftIcon size={28} />} title="Новых запросов нет">
            Ученики выбирают награды в своём кабинете и тратят на них баллы. Здесь вы подтверждаете выдачу.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-2xl" aria-hidden>
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.student?.name}</span>
                  <span className="block text-sm text-ink-soft">
                    {r.title} · {r.cost} {pluralize(r.cost, 'балл', 'балла', 'баллов')} · {formatDateTime(r.createdAt)}
                  </span>
                </span>
                {!archived && (
                  <span className="flex gap-2">
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(r, true)}>
                      <CheckIcon size={16} weight="bold" /> Выдать
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide(r, false)}>
                      <XIcon size={16} weight="bold" /> Отказать
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <details className="rounded-2xl border border-line px-4 py-3">
            <summary className="cursor-pointer font-medium">Рассмотренные ({done.length})</summary>
            <ul className="mt-3 space-y-2 text-sm">
              {done.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-x-2">
                  <span aria-hidden>{r.emoji}</span>
                  <b>{r.student?.name}</b> {r.title}, {r.cost} — <span className="text-ink-soft">{STATUS[r.status]}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="min-w-0 space-y-4">
        <PageTitle>Награды</PageTitle>
        <ul className="card divide-y divide-line overflow-hidden">
          {data.rewards.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-2xl" aria-hidden>
                {r.emoji}
              </span>
              <span className="min-w-0 flex-1 font-medium">{r.title}</span>
              <span className="chip bg-accent/25 text-ink">{r.cost}</span>
              {!archived && (
                <button className="icon-btn" title="Убрать" aria-label={`Убрать «${r.title}»`} disabled={busy} onClick={() => remove(r)}>
                  <TrashIcon size={18} />
                </button>
              )}
            </li>
          ))}
          {data.rewards.length === 0 && <li className="px-4 py-3 text-ink-soft">Наград пока нет.</li>}
        </ul>
        {!archived && (
          <form onSubmit={add} className="space-y-3 rounded-2xl border border-dashed border-line p-4">
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
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
              <div>
                <label className="label" htmlFor="reward-title">
                  Награда
                </label>
                <input id="reward-title" className="input" maxLength={60} placeholder="Например, выбрать игру на перемене" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="reward-cost">
                  Цена
                </label>
                <input
                  id="reward-cost"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                />
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy || !form.title.trim() || !(form.cost >= 1)}>
              Добавить награду
            </button>
          </form>
        )}
        <p className="text-sm text-ink-soft">
          Ученик тратит баллы, уровень героя от этого не падает. При отказе баллы возвращаются.
        </p>
      </section>
    </div>
  );
}
