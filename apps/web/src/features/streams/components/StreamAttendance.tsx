import { useEffect, useState } from 'react';
import type { StreamBoard } from '../../../lib/api';
import { dateKey, pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { fetchStreamAttendance, saveStreamAttendance } from '../api';

const LESSONS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Отметка занятия потока: каждая группа получает свою отметку за этот урок */
export function StreamAttendance({ streamId, groups }: { streamId: string; groups: StreamBoard['groups'] }) {
  const toast = useToast();
  const [date, setDate] = useState(() => dateKey());
  const [lesson, setLesson] = useState(1);
  const [present, setPresent] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useLoad(() => fetchStreamAttendance(streamId, date, lesson), [streamId, date, lesson]);
  useEffect(() => {
    if (data) setPresent(new Set(data.presentStudentIds));
  }, [data]);
  const everyone = groups.flatMap((g) => g.students.map((s) => s.id));

  function toggle(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    try {
      const res = await saveStreamAttendance(streamId, { date, lesson, presentStudentIds: [...present] });
      toast({ text: `Отмечено: ${res.presentCount} из ${res.studentsTotal}`, tone: 'ok' });
      await reload();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Посещаемость потока">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="stream-date">Дата</label>
          <input
            id="stream-date"
            type="date"
            className="input"
            max={dateKey()}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="stream-lesson">Номер занятия</label>
          <select id="stream-lesson" className="input" value={lesson} onChange={(e) => setLesson(Number(e.target.value))}>
            {LESSONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setPresent(new Set(everyone))}>Все пришли</button>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <p className="text-sm text-ink-soft" role="status">
          {data.marked
            ? `Уже отмечено в ${data.marked} из ${groups.length} ${pluralize(groups.length, 'группы', 'групп', 'групп')}`
            : 'Занятие ещё не отмечено'}
        </p>
      )}
      {groups.map((g) => (
        <fieldset key={g.id} className="card p-4">
          <legend className="px-1 font-semibold">{g.name}</legend>
          <ul className="grid gap-1 sm:grid-cols-2">
            {g.students.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                  <input type="checkbox" className="size-5" checked={present.has(s.id)} onChange={() => toggle(s.id)} />
                  <span className="min-w-0 break-words">{s.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <button className="btn btn-primary" disabled={busy || !data} onClick={save}>Сохранить отметку</button>
    </section>
  );
}
