import { useState, type FormEvent } from 'react';
import { CheckCircleIcon, FlagBannerIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { api, type ClassGoal } from '../api';
import { pluralize, points } from '../hooks';
import { Modal, ProgressBar } from './ui';

/** Общая цель на уроке и проекторе. Счёт приходит с сервера, на общем экране видны только плюсы. */
export function ClassGoalPanel({ goal, groupId, archived, projector = false, onChange }: {
  goal: ClassGoal | null;
  groupId: string;
  archived: boolean;
  projector?: boolean;
  onChange?: (goal: ClassGoal | null) => void;
}) {
  const [mode, setMode] = useState<'edit' | 'restart' | 'remove' | null>(null);
  const [form, setForm] = useState({ title: '', target: 500 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canEdit = !archived && !projector && !!onChange;
  function open(next: 'edit' | 'restart' | 'remove') {
    setError('');
    setForm(next === 'edit' && goal ? { title: goal.title, target: goal.target } : { title: '', target: 500 });
    setMode(next);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const base = `/teacher/groups/${groupId}/goal`;
    try {
      if (mode === 'remove') {
        await api('DELETE', base);
        onChange?.(null);
      } else {
        const updated = await api<ClassGoal>(mode === 'restart' ? 'POST' : 'PUT', mode === 'restart' ? `${base}/restart` : base, form);
        onChange?.(updated);
      }
      setMode(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!goal && !canEdit) return null;
  const targetText = goal ? `${goal.target} ${pluralize(goal.target, 'балла', 'баллов', 'баллов')}` : '';
  return (
    <>
      {goal ? (
        <section aria-label="Цель класса" className={`rounded-2xl border ${goal.reached ? 'border-accent bg-accent/10' : 'border-line bg-surface'} ${projector ? 'mb-8 p-6' : 'p-4 sm:p-5'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {goal.reached ? <CheckCircleIcon size={projector ? 36 : 26} weight="fill" className="shrink-0 text-plus" aria-hidden /> : <FlagBannerIcon size={projector ? 36 : 26} weight="bold" className="shrink-0 text-ink-soft" aria-hidden />}
              <h2 className={`min-w-0 break-words leading-snug ${projector ? 'text-3xl' : 'text-lg'}`}>Цель класса: {goal.title}</h2>
            </div>
            {canEdit && <button className="btn btn-ghost btn-sm -mr-2 -mt-1 shrink-0" aria-label="Изменить цель" onClick={() => open('edit')}><PencilSimpleIcon size={18} /><span className="hidden sm:inline">Изменить цель</span></button>}
          </div>
          <div className={`mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 ${projector ? 'text-2xl' : 'text-sm'}`}>
            <p className="font-semibold tabular-nums">Собрано {goal.earned} из {targetText}</p>
            <p role="status" className={`font-semibold ${goal.reached ? 'text-plus' : 'text-ink-soft'}`}>
              {goal.reached ? 'Цель достигнута!' : `Осталось ${points(goal.target - goal.earned)}`}
            </p>
          </div>
          <ProgressBar value={goal.earned / goal.target} label={`Цель класса: ${goal.title}`} valueText={`${goal.earned} из ${targetText}`} className={`mt-3 ${projector ? 'h-5' : ''}`} />
          {canEdit && goal.reached && <button className="btn btn-secondary btn-sm mt-4" onClick={() => open('restart')}><PlusIcon size={18} /> Новая цель</button>}
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line p-4">
          <p className="text-sm text-ink-soft">Придумайте общую цель, к которой класс будет идти вместе.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => open('edit')}><FlagBannerIcon size={18} /> Задать цель класса</button>
        </div>
      )}
      <Modal open={!!mode} title={mode === 'remove' ? 'Убрать цель класса?' : mode === 'restart' ? 'Новая цель класса' : goal ? 'Изменить цель класса' : 'Цель класса'} onClose={() => { if (!busy) setMode(null); }}>
        <form onSubmit={save} className="space-y-4">
          {mode === 'remove' ? (
            <p>Цель и её прогресс будут убраны. Баллы учеников и история начислений сохранятся.</p>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="class-goal-title">Что сделаем вместе?</label>
                <input id="class-goal-title" className="input" maxLength={100} required placeholder="Например, устроим киноурок" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="class-goal-target">Сколько баллов нужно собрать?</label>
                <input id="class-goal-target" className="input" type="number" inputMode="numeric" min={1} max={1_000_000} required value={form.target || ''} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} />
              </div>
              <p className="text-sm text-ink-soft">Вместе собираем новые плюсы, включая посещаемость. Минусы и покупки наград не уменьшают прогресс.</p>
              {mode === 'restart' ? <p className="font-medium">Новая цель начнётся с нуля. Баллы учеников сохранятся.</p> : goal && <p className="text-sm text-ink-soft">При изменении цели уже собранные баллы сохраняются.</p>}
            </>
          )}
          {error && <p role="alert" className="text-sm text-minus">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className={`btn ${mode === 'remove' ? 'btn-danger' : 'btn-primary'}`} disabled={busy || (mode !== 'remove' && (!form.title.trim() || !Number.isInteger(form.target) || form.target < 1 || form.target > 1_000_000))}>
              {busy ? 'Сохраняем…' : mode === 'remove' ? 'Убрать цель' : mode === 'restart' ? 'Начать с нуля' : goal ? 'Сохранить изменения' : 'Начать собирать'}
            </button>
            {mode === 'edit' && goal && <>
              <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => open('restart')}>Новая цель с нуля</button>
              <button className="btn btn-ghost text-minus" type="button" disabled={busy} onClick={() => open('remove')}>Убрать цель</button>
            </>}
          </div>
        </form>
      </Modal>
    </>
  );
}
