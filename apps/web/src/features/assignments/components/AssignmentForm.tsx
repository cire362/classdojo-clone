import { useId, useState, type FormEvent } from 'react';
import type { TeacherAssignment } from '../../../lib/api';
import { prepareAttachments } from '../../../lib/attachments';
import { dateKey } from '../../../lib/hooks';
import { AttachmentPicker } from '../../../ui/Attachments';
import { useToast } from '../../../ui/Toast';
import { useGroup } from '../../groups';
import { createAssignment, type AssignmentDraft } from '../api';
import { useTerms } from '../../auth';
import { cap, type Terms } from '@heroes/shared/terms';

const EMPTY: AssignmentDraft = { title: '', description: '', dueOn: '', points: 0, target: 'all', teamId: '', studentIds: [], files: [] };
const targets = (t: Terms) => [
  ['all', 'Всей группе'],
  ['team', 'Команде'],
  ['students', `Выбранным ${t.student.many.dat}`],
] as const;

/** Новое задание: кому, что сделать, к какому дню и сколько баллов за принятый ответ */
export function AssignmentForm({ onCreated }: { onCreated: (list: TeacherAssignment[]) => void }) {
  const t = useTerms();
  const id = useId();
  const toast = useToast();
  const { data } = useGroup();
  const [draft, setDraft] = useState<AssignmentDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<AssignmentDraft>) => setDraft({ ...draft, ...patch });
  const toggleStudent = (studentId: string, on: boolean) =>
    set({ studentIds: on ? [...draft.studentIds, studentId] : draft.studentIds.filter((s) => s !== studentId) });
  const ready =
    !!draft.title.trim() &&
    (draft.target !== 'team' || !!draft.teamId) &&
    (draft.target !== 'students' || draft.studentIds.length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const files = await prepareAttachments(draft.files);
      const clean = { ...draft, title: draft.title.trim(), description: draft.description.trim(), files };
      onCreated(await createAssignment(data.group.id, clean));
      setDraft(EMPTY);
      toast({ text: 'Задание выдано', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg">Новое задание</h2>
      <div>
        <label className="label" htmlFor={`${id}-name`}>Что сделать</label>
        <input
          id={`${id}-name`}
          className="input"
          maxLength={100}
          placeholder="Например: решить задачи 1–5"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-text`}>Подробности, если нужны</label>
        <textarea
          id={`${id}-text`}
          className="input min-h-20 resize-y"
          maxLength={2000}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-due`}>Сдать до</label>
          <input
            id={`${id}-due`}
            type="date"
            className="input"
            min={dateKey()}
            value={draft.dueOn}
            onChange={(e) => set({ dueOn: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-points`}>Баллы за выполнение</label>
          <select id={`${id}-points`} className="input" value={draft.points} onChange={(e) => set({ points: Number(e.target.value) })}>
            {Array.from({ length: 11 }, (_, n) => (
              <option key={n} value={n}>{n === 0 ? 'Без баллов' : n}</option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Кому</legend>
        <div className="flex flex-wrap gap-2">
          {targets(t).filter(([value]) => value !== 'team' || data.teams.length > 0).map(([value, label]) => (
            <label
              key={value}
              className={`chip cursor-pointer px-3 py-2 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/60 ${
                draft.target === value ? 'bg-ink text-bg' : 'bg-surface-2 text-ink'
              }`}
            >
              <input
                type="radio"
                name={`${id}-target`}
                className="sr-only"
                checked={draft.target === value}
                onChange={() => set({ target: value })}
              />
              {label}
            </label>
          ))}
        </div>
        {draft.target === 'team' && (
          <select aria-label="Команда" className="input" value={draft.teamId} onChange={(e) => set({ teamId: e.target.value })}>
            <option value="">Выберите команду</option>
            {data.teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {draft.target === 'students' && (
          <ul className="grid gap-1 sm:grid-cols-2" aria-label={cap(t.student.many.nom)}>
            {data.students.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={draft.studentIds.includes(s.id)}
                    onChange={(e) => toggleStudent(s.id, e.target.checked)}
                  />
                  {s.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <AttachmentPicker files={draft.files} onChange={(files) => set({ files })} disabled={busy} />
      </div>
      <button className="btn btn-primary" disabled={busy || !ready}>Выдать задание</button>
    </form>
  );
}
