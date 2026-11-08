import { useState, type FormEvent } from 'react';
import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { cap } from '@heroes/shared/terms';
import type { Subject } from '../../../lib/api';
import { pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useTerms } from '../../auth';
import { createAdminSubject, deleteAdminSubject, fetchAdminSubjects, renameAdminSubject } from '../api';

/** Каталог дисциплин учреждения: из него группы выбирают свои. Преподаватели тоже могут добавлять */
export function AdminSubjects({ canEdit }: { canEdit: boolean }) {
  const t = useTerms();
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => fetchAdminSubjects(), []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const title = cap(t.subject.many.nom);

  async function run(action: () => Promise<Subject[]>) {
    setBusy(true);
    try {
      setData(await action());
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  function add(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const list = await createAdminSubject(name.trim());
      setName('');
      return list;
    });
  }

  return (
    <section className="max-w-2xl space-y-4" aria-labelledby="subjects-title">
      <h2 id="subjects-title" className="text-lg">{title}</h2>
      <p className="text-sm text-ink-soft">
        Общий список учреждения. Создатель группы назначает из него {t.subject.many.acc} и преподавателей.
      </p>
      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-60">
            <label className="label" htmlFor="subject-name">Новая запись</label>
            <input id="subject-name" className="input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>Добавить</button>
        </form>
      )}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-32" />}
      {data && data.length === 0 && <p className="text-ink-soft">Список пока пуст.</p>}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden" aria-label={title}>
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">{s.name}</span>
                <span className="block text-sm text-ink-soft">{s.groups} {pluralize(s.groups, 'группа', 'группы', 'групп')}</span>
              </span>
              {canEdit && (
                <>
                  <button
                    className="icon-btn"
                    aria-label={`Переименовать «${s.name}»`}
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt('Новое название', s.name)?.trim();
                      if (next && next !== s.name) void run(() => renameAdminSubject(s.id, next));
                    }}
                  >
                    <PencilSimpleIcon size={20} />
                  </button>
                  <button
                    className="icon-btn hover:text-minus"
                    aria-label={`Удалить «${s.name}»`}
                    disabled={busy}
                    onClick={() => run(() => deleteAdminSubject(s.id))}
                  >
                    <TrashIcon size={20} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
