import { useState, type FormEvent } from 'react';
import { MegaphoneIcon, TrashIcon } from '@phosphor-icons/react';
import { api, type FeedPost } from '../../../lib/api';
import { formatDateTime, useLoad } from '../../../lib/hooks';
import { useNotifications } from '../../notifications';
import { useToast } from '../../../ui/Toast';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';

const MAX = 2000;

/** Лента класса. С compose — форма для преподавателя (postTo — адрес публикации) */
export function Feed({ path, postTo, readOnlyNote, onLoaded }: { path: string; postTo?: string; readOnlyNote?: string; onLoaded?: () => void }) {
  const toast = useToast();
  const { refresh } = useNotifications();
  const { data, setData, error, reload } = useLoad(async () => {
    const posts = await api<FeedPost[]>('GET', path);
    void refresh();
    onLoaded?.();
    return posts;
  }, [path]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!postTo) return;
    setBusy(true);
    try {
      const post = await api<FeedPost>('POST', postTo, { text: text.trim() });
      setData([post, ...(data ?? [])]);
      setText('');
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(post: FeedPost) {
    try {
      await api('DELETE', `/teacher/posts/${post.id}`);
      setData((data ?? []).filter((p) => p.id !== post.id));
      toast({ text: 'Запись удалена', tone: 'neutral' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="sr-only">Лента класса</h2>
      {postTo && (
        <form onSubmit={publish} className="card space-y-3 p-4">
          <label className="label" htmlFor="post-text">
            Объявление для учеников и родителей
          </label>
          <textarea
            id="post-text"
            className="input min-h-24 resize-y"
            placeholder="Например: в пятницу урок переносится на 15:00"
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-soft tabular-nums">{text.length > MAX - 200 ? `${text.length} / ${MAX}` : ''}</span>
            <button className="btn btn-primary" disabled={busy || !text.trim()}>
              Опубликовать
            </button>
          </div>
        </form>
      )}
      {readOnlyNote && <p className="text-sm text-ink-soft">{readOnlyNote}</p>}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-32" />}
      {data?.length === 0 && (
        <EmptyState icon={<MegaphoneIcon size={28} />} title="Пока без объявлений">
          {postTo ? 'Здесь появятся ваши объявления для учеников и родителей.' : 'Когда преподаватель напишет объявление, оно появится здесь.'}
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((p) => (
            <li key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{p.author}</span> · {formatDateTime(p.createdAt)}
                </div>
                {p.canDelete && (
                  <button className="icon-btn -mr-2 -mt-2" title="Удалить" aria-label="Удалить запись" onClick={() => remove(p)}>
                    <TrashIcon size={18} />
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line break-words">{p.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
