import { useState, type FormEvent } from 'react';
import type { HomeGoal } from '../../../lib/api';
import { Modal } from '../../../ui';
import { addPoints } from '../api';
import { useSave } from '../hooks/useSave';

const MAX_POINTS = 10;

/** Начисление за дело или в счёт цели. goals: только незавершённые */
export function PointModal({ path, goals, onClose, onSaved }: {
  path: string;
  goals: HomeGoal[];
  onClose: () => void;
  onSaved: () => unknown;
}) {
  const [goalId, setGoalId] = useState('');
  const [reason, setReason] = useState('');
  const [points, setPoints] = useState('1');
  const { busy, run } = useSave(onSaved);
  const amount = Number(points);
  const valid = (goalId || reason.trim()) && Number.isInteger(amount) && amount >= 1 && amount <= MAX_POINTS;

  function save(e: FormEvent) {
    e.preventDefault();
    void run(() => addPoints(path, { goalId: goalId || null, reason: reason.trim(), points: amount }));
  }

  return (
    <Modal open title="Начислить домашние баллы" onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        {goals.length > 0 && (
          <div>
            <label className="label" htmlFor="home-point-goal">Цель</label>
            <select id="home-point-goal" className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">Без цели</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="home-point-reason">За что</label>
          <input
            id="home-point-reason"
            className="input"
            maxLength={120}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {goalId && <p className="mt-1 text-sm text-ink-soft">Можно не заполнять: в истории будет название цели.</p>}
        </div>
        <div>
          <label className="label" htmlFor="home-point-value">Баллы, от 1 до {MAX_POINTS}</label>
          <input
            id="home-point-value"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_POINTS}
            className="input w-32"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" disabled={busy || !valid}>Начислить</button>
      </form>
    </Modal>
  );
}
