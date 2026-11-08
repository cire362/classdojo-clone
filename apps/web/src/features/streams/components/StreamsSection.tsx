import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { StreamItem } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useTerms } from '../../auth';
import { deleteStream, fetchStreams } from '../api';
import { streamCaption } from './StreamBoard';
import { StreamForm } from './StreamForm';

/** Потоки преподавателя на главной: в колледже и вузе лекции часто идут у нескольких групп сразу */
export function StreamsSection() {
  const t = useTerms();
  const toast = useToast();
  const enabled = t.kind !== 'SCHOOL';
  const { data, error, reload, setData } = useLoad(() => (enabled ? fetchStreams() : Promise.resolve([])), [enabled]);
  const [editing, setEditing] = useState<StreamItem | 'new' | null>(null);
  if (!enabled) return null;

  async function remove(stream: StreamItem) {
    try {
      setData(await deleteStream(stream.id));
      toast({ text: `Поток «${stream.name}» удалён. Баллы и отметки остались в группах`, tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="streams-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="streams-title" className="text-lg">Потоки</h2>
        <button className="btn btn-secondary" onClick={() => setEditing('new')}>
          <PlusIcon size={18} weight="bold" /> Новый поток
        </button>
      </div>
      <p className="text-sm text-ink-soft">
        Лекция у нескольких групп: баллы и посещаемость ставятся сразу всем и записываются в каждую группу.
      </p>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden" aria-label="Потоки">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-2 p-3">
              <Link to={`/streams/${s.id}`} className="min-w-0 flex-1 rounded-lg">
                <span className="block break-words font-semibold">{s.name}</span>
                <span className="block break-words text-sm text-ink-soft">{streamCaption(s)}</span>
              </Link>
              <button className="icon-btn" aria-label={`Изменить «${s.name}»`} onClick={() => setEditing(s)}>
                <PencilSimpleIcon size={20} />
              </button>
              <button className="icon-btn hover:text-minus" aria-label={`Удалить «${s.name}»`} onClick={() => remove(s)}>
                <TrashIcon size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <StreamForm
          stream={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(list) => {
            setData(list);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
