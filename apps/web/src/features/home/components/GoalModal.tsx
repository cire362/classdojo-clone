import { useState, type FormEvent } from 'react';
import type { HomeGoal } from '../../../lib/api';
import { Modal } from '../../../ui';
import { createGoal, deleteGoal, updateGoal } from '../api';
import { useSave } from '../hooks/useSave';

const MAX_TARGET = 500;

/** Новая домашняя цель или изменение существующей */
export function GoalModal({ path, goal, onClose, onSaved }: {
  path: string;
  goal: HomeGoal | null;
  onClose: () => void;
  onSaved: () => unknown;
}) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(String(goal?.target ?? 10));
  const { busy, run } = useSave(onSaved);
  const amount = Number(target);
  const valid = title.trim() && Number.isInteger(amount) && amount >= 1 && amount <= MAX_TARGET;

  function save(e: FormEvent) {
    e.preventDefault();
    const data = { title: title.trim(), target: amount };
    void run(() => (goal ? updateGoal(path, goal.id, data) : createGoal(path, data)));
  }

  return (
    <Modal open title={goal ? 'Домашняя цель' : 'Новая цель'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="home-goal-title">Цель</label>
          <input
            id="home-goal-title"
            className="input"
            maxLength={120}
            autoFocus
            placeholder="Убирать комнату без напоминаний"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="home-goal-target">Сколько баллов собрать</label>
          <input
            id="home-goal-target"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_TARGET}
            className="input w-32"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        {goal && <p className="text-sm text-ink-soft">Если удалить цель, начисления останутся в истории и общей сумме.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy || !valid}>Сохранить</button>
          {goal && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => deleteGoal(path, goal.id))}>
              Удалить
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
