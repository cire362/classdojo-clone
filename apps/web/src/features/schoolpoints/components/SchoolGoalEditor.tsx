import { useState, type FormEvent } from 'react';
import { FlagBannerIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import type { SchoolGoal } from '../../../lib/api';
import { Modal } from '../../../ui';
import { deleteSchoolGoal, saveSchoolGoal } from '../api';
import { SchoolGoalCard } from './SchoolGoalCard';

type Mode = 'edit' | 'restart' | 'remove';
const TITLES: Record<Mode, string> = { edit: 'Цель школы', restart: 'Новая цель школы', remove: 'Убрать цель школы?' };

/** Цель школы в панели: директор и завуч ставят, меняют или начинают заново */
export function SchoolGoalEditor({ goal, canEdit, onChange }: {
  goal: SchoolGoal | null;
  canEdit: boolean;
  onChange: (goal: SchoolGoal | null) => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState({ title: '', target: 1000 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const open = (next: Mode) => {
    setError('');
    setForm(next === 'edit' && goal ? { title: goal.title, target: goal.target } : { title: '', target: 1000 });
    setMode(next);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'remove') {
        await deleteSchoolGoal();
        onChange(null);
      } else onChange(await saveSchoolGoal({ title: form.title.trim(), target: form.target, restart: mode === 'restart' }));
      setMode(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const valid = mode === 'remove' || (form.title.trim() && Number.isInteger(form.target) && form.target >= 10);
  return (
    <>
      {goal ? (
        <SchoolGoalCard goal={goal}>
          {canEdit && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => open('edit')}>
                <PencilSimpleIcon size={18} aria-hidden /> Изменить
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => open('restart')}>Новая цель с нуля</button>
              <button className="btn btn-ghost btn-sm text-minus" onClick={() => open('remove')}>Убрать</button>
            </div>
          )}
        </SchoolGoalCard>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line p-4">
          <p className="text-sm text-ink-soft">Общая цель школы: все классы копят к ней плюсы вместе.</p>
          {canEdit && (
            <button className="btn btn-secondary btn-sm" onClick={() => open('edit')}>
              <FlagBannerIcon size={18} aria-hidden /> Задать цель школы
            </button>
          )}
        </div>
      )}
      <Modal open={!!mode} title={mode ? TITLES[mode] : ''} onClose={() => { if (!busy) setMode(null); }}>
        <form onSubmit={save} className="space-y-4">
          {mode === 'remove' ? (
            <p>Цель и её прогресс будут убраны. Баллы учеников и классов сохранятся.</p>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="school-goal-title">Что сделаем всей школой?</label>
                <input
                  id="school-goal-title"
                  className="input"
                  maxLength={80}
                  placeholder="Например, школьный пикник"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="school-goal-target">Сколько баллов собрать всем классам?</label>
                <input
                  id="school-goal-target"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  value={form.target || ''}
                  onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
                />
              </div>
              <p className="text-sm text-ink-soft">Считаются плюсы всех классов школы после запуска цели. Минусы прогресс не уменьшают.</p>
            </>
          )}
          {error && <p role="alert" className="text-sm text-minus">{error}</p>}
          <button className={`btn ${mode === 'remove' ? 'btn-danger' : 'btn-primary'}`} disabled={busy || !valid}>
            {mode === 'remove' ? 'Убрать цель' : mode === 'restart' ? 'Начать с нуля' : 'Сохранить'}
          </button>
        </form>
      </Modal>
    </>
  );
}
