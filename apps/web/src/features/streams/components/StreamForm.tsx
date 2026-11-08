import { useState, type FormEvent } from 'react';
import { cap } from '@heroes/shared/terms';
import type { StreamItem } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { Modal, Skeleton } from '../../../ui';
import { useTerms } from '../../auth';
import { fetchGroups } from '../../groups';
import { fetchSubjects } from '../../subjects';
import { saveStream } from '../api';

/** Создание и правка потока: название, группы (хотя бы две) и дисциплина */
export function StreamForm({ stream, onClose, onSaved }: {
  stream: StreamItem | null;
  onClose: () => void;
  onSaved: (list: StreamItem[]) => void;
}) {
  const t = useTerms();
  const groups = useLoad(() => fetchGroups(), []);
  const subjects = useLoad(() => fetchSubjects(), []);
  const [name, setName] = useState(stream?.name ?? '');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(stream?.groups.map((g) => g.id) ?? []));
  const [subjectId, setSubjectId] = useState(stream?.subject?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = (Array.isArray(groups.data) ? groups.data : []).filter((g) => !g.archivedAt);
  const subjectList = Array.isArray(subjects.data) ? subjects.data : [];

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveStream(stream?.id ?? null, { name: name.trim(), groupIds: [...picked], subjectId: subjectId || null }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={stream ? `Поток «${stream.name}»` : 'Новый поток'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="stream-name">Название</label>
          <input
            id="stream-name"
            className="input"
            maxLength={80}
            placeholder="Например, История, лекция 1 курса"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="label">Группы</legend>
          {!groups.data && !groups.error && <Skeleton className="h-20" />}
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {active.map((g) => (
              <li key={g.id}>
                <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                  <input type="checkbox" className="size-5" checked={picked.has(g.id)} onChange={() => toggle(g.id)} />
                  <span className="min-w-0 break-words">{g.name}</span>
                </label>
              </li>
            ))}
          </ul>
          {picked.size < 2 && <p className="mt-1 text-sm text-ink-soft">Выберите хотя бы две группы.</p>}
        </fieldset>
        {subjectList.length > 0 && (
          <div>
            <label className="label" htmlFor="stream-subject">{cap(t.subject.one.nom)}</label>
            <select id="stream-subject" className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Без {t.subject.one.gen}</option>
              {subjectList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {error && <p className="text-sm font-medium text-minus">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !name.trim() || picked.size < 2}>Сохранить</button>
      </form>
    </Modal>
  );
}
