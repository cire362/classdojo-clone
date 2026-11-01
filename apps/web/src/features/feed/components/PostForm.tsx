import { useState, type FormEvent } from 'react';
import type { FeedPost } from '../../../lib/api';
import { dateKey } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import { createPost } from '../api';

const MAX = 2000;

/** Значение для поля datetime-local в часовом поясе браузера */
const localNow = () => {
  const now = new Date();
  return `${dateKey(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

export function PostForm({ postTo, onPosted }: { postTo: string; onPosted: (post: FeedPost) => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [later, setLater] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [busy, setBusy] = useState(false);

  async function publish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onPosted(await createPost(postTo, text.trim(), later ? new Date(publishAt).toISOString() : undefined));
      setText('');
      setLater(false);
      setPublishAt('');
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
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
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
          Опубликовать позже
        </label>
        {later && (
          <input
            type="datetime-local"
            className="input w-auto"
            aria-label="Дата и время публикации"
            min={localNow()}
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-soft tabular-nums">{text.length > MAX - 200 ? `${text.length} / ${MAX}` : ''}</span>
        <button className="btn btn-primary" disabled={busy || !text.trim() || (later && !publishAt)}>
          {later ? 'Запланировать' : 'Опубликовать'}
        </button>
      </div>
    </form>
  );
}
