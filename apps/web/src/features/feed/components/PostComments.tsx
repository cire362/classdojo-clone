import { useId, useState, type FormEvent } from 'react';
import { TrashIcon } from '@phosphor-icons/react';
import type { FeedComment } from '../../../lib/api';
import { formatDateTime } from '../../../lib/hooks';

const MAX = 500;

/** Разговор взрослых под записью: ученикам сервер комментарии не отдаёт */
export function PostComments({ comments, canComment, disabledNote, onAdd, onDelete }: {
  comments: FeedComment[];
  canComment: boolean;
  disabledNote?: string;
  onAdd: (text: string) => Promise<boolean>;
  onDelete: (comment: FeedComment) => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (await onAdd(text.trim())) setText('');
    setBusy(false);
  }

  if (!comments.length && !canComment) return disabledNote ? <p className="mt-3 text-sm text-ink-soft">{disabledNote}</p> : null;
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {comments.length > 0 && (
        <ul aria-label="Комментарии" className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="text-ink-soft">
                  <span className="font-semibold text-ink">{c.author}</span> · {formatDateTime(c.createdAt)}
                </div>
                <p className="whitespace-pre-line break-words">{c.text}</p>
              </div>
              {c.canDelete && (
                <button className="icon-btn -mr-1 -mt-1" title="Удалить" aria-label="Удалить комментарий" onClick={() => onDelete(c)}>
                  <TrashIcon size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canComment ? (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`${id}-comment`}>Комментарий</label>
            <textarea
              id={`${id}-comment`}
              rows={1}
              className="input min-h-11 resize-y"
              placeholder="Написать комментарий"
              maxLength={MAX}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary self-end" disabled={busy || !text.trim()}>Отправить</button>
        </form>
      ) : (
        disabledNote && <p className="text-sm text-ink-soft">{disabledNote}</p>
      )}
    </div>
  );
}
