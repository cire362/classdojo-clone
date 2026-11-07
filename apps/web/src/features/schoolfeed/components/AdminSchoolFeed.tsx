import { useState, type FormEvent } from 'react';
import { TrashIcon } from '@phosphor-icons/react';
import type { AdminSchoolPost } from '../../../lib/api';
import { prepareAttachments } from '../../../lib/attachments';
import { pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { AttachmentPicker } from '../../../ui/Attachments';
import { useToast } from '../../../ui/Toast';
import { createSchoolPost, deleteSchoolPost, fetchAdminSchoolFeed } from '../api';
import { SchoolPostCard } from './SchoolPostCard';
import { useTerms } from '../../auth';

const EMPTY = { text: '', important: false, files: [] as File[] };

/** Сколько читателей открыли ленту после объявления: семьи в школе, студенты в колледже и вузе */
function Reach({ reach }: { reach: NonNullable<AdminSchoolPost['reach']> }) {
  const t = useTerms();
  const students = reach.audience === 'students';
  if (!reach.total) return <p className="text-sm text-ink-soft">Пока нет {students ? t.student.many.gen : 'семей'} со входом.</p>;
  const word = students
    ? pluralize(reach.total, t.student.one.gen, t.student.many.gen, t.student.many.gen)
    : pluralize(reach.total, 'семьи', 'семей', 'семей');
  return <p className="text-sm font-semibold">Прочитали {reach.read} из {reach.total} {word}</p>;
}

/** Лента школы в панели: директор и завуч пишут и удаляют записи, сотрудник только читает */
export function AdminSchoolFeed({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const t = useTerms();
  // В школе объявления читают семьи, в колледже и вузе — сами студенты
  const readersDat = t.kind === 'SCHOOL' ? 'всем семьям' : `всем ${t.student.many.dat}`;
  const readersAll = t.kind === 'SCHOOL' ? 'всех семей' : `всех ${t.student.many.gen}`;
  const { data, error, reload, setData } = useLoad(() => fetchAdminSchoolFeed(), []);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<AdminSchoolPost | null>(null);

  async function publish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData();
      form.append('text', draft.text.trim());
      if (draft.important) form.append('important', 'true');
      for (const file of await prepareAttachments(draft.files)) form.append('file', file);
      setData(await createSchoolPost(form));
      setDraft(EMPTY);
      toast({ text: draft.important ? `Объявление отправлено ${readersDat}` : 'Запись опубликована', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      setData(await deleteSchoolPost(removing.id));
      setRemoving(null);
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-5" aria-labelledby="school-feed-title">
      <div className="space-y-1">
        <h2 id="school-feed-title" className="text-lg">Лента {t.org.one.gen}</h2>
        <p className="text-sm text-ink-soft">
          {t.kind === 'SCHOOL'
            ? `Записи видят преподаватели и семьи ${t.student.many.gen} действующих ${t.group.many.gen}. `
              + `Сами ${t.student.many.nom} ленту не видят.`
            : `Записи видят преподаватели и ${t.student.many.nom} действующих ${t.group.many.gen}, а также родители, если им выдан вход.`}
        </p>
      </div>
      {canWrite && (
        <form className="card space-y-4 p-5" onSubmit={publish}>
          <div>
            <label className="label" htmlFor="school-post-text">Новая запись</label>
            <textarea
              id="school-post-text"
              className="input min-h-28"
              maxLength={5000}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
          </div>
          <AttachmentPicker files={draft.files} onChange={(files) => setDraft({ ...draft, files })} disabled={busy} />
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1.5"
              checked={draft.important}
              onChange={(e) => setDraft({ ...draft, important: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Объявление для {readersAll}</span>
              <span className="block text-sm text-ink-soft">
                Запись выделяется, а вы видите, сколько {t.kind === 'SCHOOL' ? 'семей' : t.student.many.gen} её прочитали.
              </span>
            </span>
          </label>
          <button className="btn btn-primary" disabled={busy || (!draft.text.trim() && !draft.files.length)}>
            {busy ? 'Публикуем…' : 'Опубликовать'}
          </button>
        </form>
      )}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && data.length === 0 && <p className="text-ink-soft">Записей пока нет.</p>}
      {data && data.length > 0 && (
        <ul className="space-y-4" aria-label={`Записи ${t.org.one.gen}`}>
          {data.map((post) => (
            <li key={post.id}>
              <SchoolPostCard post={post}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {post.reach ? <Reach reach={post.reach} /> : <span />}
                  {canWrite && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      aria-describedby={`school-post-${post.id}`}
                      onClick={() => setRemoving(post)}
                    >
                      <TrashIcon size={18} aria-hidden /> Удалить
                    </button>
                  )}
                </div>
              </SchoolPostCard>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!removing} title="Удалить запись?" onClose={() => { if (!busy) setRemoving(null); }}>
        <div className="space-y-4">
          <p>Запись и её файлы исчезнут из ленты у всех, кто её видит.</p>
          <button className="btn btn-primary" disabled={busy} onClick={remove}>Удалить запись</button>
        </div>
      </Modal>
    </section>
  );
}
