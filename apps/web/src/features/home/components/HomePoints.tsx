import { useState } from 'react';
import { CheckIcon, HouseIcon, PencilSimpleIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import type { HomeGoal } from '../../../lib/api';
import { formatDateTime, useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, ProgressBar, Skeleton } from '../../../ui';
import { addPoints, deletePoint, fetchHome } from '../api';
import { useSave } from '../hooks/useSave';
import { GoalModal } from './GoalModal';
import { PointModal } from './PointModal';
import { useTerms } from '../../auth';

/** В кабинете ученика блок идёт после профиля и не должен его вытеснять */
const STUDENT_HISTORY = 5;

const isDone = (goal: HomeGoal) => goal.progress >= goal.target;

/** Домашние цели и начисления. С editable родитель их ведёт, ученику они только видны, а пустой блок скрыт */
export function HomePoints({ path, editable = false }: { path: string; editable?: boolean }) {
  const t = useTerms();
  const { data, error, reload } = useLoad(() => fetchHome(path), [path]);
  const [modal, setModal] = useState<HomeGoal | 'goal' | 'point' | null>(null);
  const { busy, run } = useSave(reload);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return editable ? <Skeleton className="h-40 max-w-2xl" /> : null;
  const empty = !data.goals.length && !data.history.length;
  if (empty && !editable) return null;

  const close = () => setModal(null);
  const saved = async () => {
    close();
    await reload();
  };
  const newGoal = (
    <button className="btn btn-secondary btn-sm" onClick={() => setModal('goal')}>
      <PlusIcon size={18} aria-hidden /> Новая цель
    </button>
  );

  return (
    <section aria-label="Домашние баллы" className="max-w-2xl space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/25">
          <HouseIcon size={26} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="text-lg">Домашние баллы: {data.total}</h2>
          <p className="text-sm text-ink-soft">
            {editable
              ? `Их видит только семья. На баллы ${t.org.one.gen}, уровень героя и магазин они не влияют.`
              : `Их начисляют родители. На баллы ${t.org.one.gen}, уровень героя и магазин они не влияют.`}
          </p>
        </div>
        {editable && <button className="btn btn-primary btn-sm" onClick={() => setModal('point')}>Начислить</button>}
      </div>

      {empty ? (
        <EmptyState icon={<HouseIcon size={28} />} title="Домашних целей пока нет">
          <p className="mb-3">Договоритесь с ребёнком о цели, например 20 баллов за уборку комнаты. Начислять можно и без цели.</p>
          {newGoal}
        </EmptyState>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-sans text-sm font-semibold text-ink-soft">Цели</h3>
            {editable && newGoal}
          </div>
          <ul className="space-y-2">
            {data.goals.map((goal) => {
              const shown = Math.min(goal.progress, goal.target);
              return (
                <li key={goal.id} className="card p-4">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-words font-semibold">{goal.title}</p>
                    {isDone(goal) && (
                      <span className="chip bg-plus-bg text-xs text-plus">
                        <CheckIcon size={14} weight="bold" aria-hidden /> Достигнута
                      </span>
                    )}
                    {editable && (
                      <button className="icon-btn -mr-2 -mt-2" aria-label={`Изменить: ${goal.title}`} onClick={() => setModal(goal)}>
                        <PencilSimpleIcon size={18} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar className="flex-1" value={shown / goal.target} label={goal.title} valueText={`${shown} из ${goal.target}`} />
                    <span className="text-sm tabular-nums text-ink-soft">{shown} из {goal.target}</span>
                    {editable && !isDone(goal) && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        aria-label={`Добавить балл: ${goal.title}`}
                        onClick={() => run(() => addPoints(path, { goalId: goal.id, reason: '', points: 1 }))}
                      >
                        +1
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data.history.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-sans text-sm font-semibold text-ink-soft">Последние начисления</h3>
          <ul className="card divide-y divide-line">
            {data.history.slice(0, editable ? undefined : STUDENT_HISTORY).map((point) => (
              <li key={point.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-10 shrink-0 font-semibold tabular-nums text-plus">+{point.points}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words">{point.reason}</p>
                  <p className="text-sm text-ink-soft">{formatDateTime(point.createdAt)}</p>
                </div>
                {editable && (
                  <button
                    className="icon-btn -mr-2"
                    disabled={busy}
                    aria-label={`Отменить начисление: ${point.reason}`}
                    onClick={() => run(() => deletePoint(path, point.id))}
                  >
                    <XIcon size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {modal === 'point' && <PointModal path={path} goals={data.goals.filter((g) => !isDone(g))} onClose={close} onSaved={saved} />}
      {modal && modal !== 'point' && (
        <GoalModal
          key={modal === 'goal' ? 'new' : modal.id}
          path={path}
          goal={modal === 'goal' ? null : modal}
          onClose={close}
          onSaved={saved}
        />
      )}
    </section>
  );
}
