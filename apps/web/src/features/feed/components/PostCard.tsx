import { useState } from 'react';
import { ClockIcon, HeartIcon, PushPinIcon, PushPinSlashIcon, StarIcon, ThumbsUpIcon, TrashIcon } from '@phosphor-icons/react';
import { REACTION_KINDS, type ReactionKind } from '@heroes/shared';
import type { FeedComment, FeedPost } from '../../../lib/api';
import { formatDateTime } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import { addComment, deleteComment, setPinned, setReaction } from '../api';
import { PostComments } from './PostComments';
import { PostPhotos } from './PostPhotos';

const REACTIONS: Record<ReactionKind, { label: string; icon: typeof HeartIcon }> = {
  like: { label: 'Нравится', icon: ThumbsUpIcon },
  heart: { label: 'С любовью', icon: HeartIcon },
  star: { label: 'Отлично', icon: StarIcon },
};

export function PostCard({ post, path, commentsNote, onChange, onDelete }: {
  post: FeedPost;
  path: string;
  commentsNote?: string;
  onChange: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run(request: () => Promise<FeedPost>) {
    if (busy) return false;
    setBusy(true);
    try {
      onChange(await request());
      return true;
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const react = (kind: ReactionKind) => run(() => setReaction(path, post.id, post.myReaction === kind ? null : kind));
  const removeComment = (comment: FeedComment) => run(() => deleteComment(path, post.id, comment.id));

  return (
    <li className={`card p-4 ${post.pinned ? 'ring-2 ring-accent' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm text-ink-soft">
          <span className="font-semibold text-ink">{post.author}</span> · {formatDateTime(post.createdAt)}
          {post.pinned && <span className="chip ml-2 bg-accent text-xs text-on-accent">Закреплено</span>}
          {post.scheduled && (
            <span className="chip ml-2 bg-surface-2 text-xs text-ink">
              <ClockIcon size={14} aria-hidden /> Выйдет в это время
            </span>
          )}
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0">
          {post.canPin && (
            <button
              className="icon-btn"
              title={post.pinned ? 'Открепить' : 'Закрепить'}
              aria-label={post.pinned ? 'Открепить запись' : 'Закрепить запись'}
              onClick={() => run(() => setPinned(path, post.id, !post.pinned))}
            >
              {post.pinned ? <PushPinSlashIcon size={18} /> : <PushPinIcon size={18} />}
            </button>
          )}
          {post.canDelete && (
            <button className="icon-btn" title="Удалить" aria-label="Удалить запись" onClick={() => onDelete(post)}>
              <TrashIcon size={18} />
            </button>
          )}
        </div>
      </div>
      {post.text && <p className="mt-2 whitespace-pre-line break-words">{post.text}</p>}
      <PostPhotos ids={post.photos} />
      {!post.scheduled && (
        <div role="group" aria-label="Реакции" className="mt-3 flex flex-wrap gap-1.5">
          {REACTION_KINDS.map((kind) => {
            const { label, icon: Icon } = REACTIONS[kind];
            const mine = post.myReaction === kind;
            const count = post.reactions[kind];
            if (!post.canReact && !count) return null;
            return (
              <button
                key={kind}
                className={[
                  'chip min-h-9 gap-1.5 px-3 tabular-nums transition',
                  mine ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink',
                ].join(' ')}
                aria-pressed={mine}
                aria-label={`${label}: ${count}`}
                disabled={!post.canReact}
                onClick={() => react(kind)}
              >
                <Icon size={16} weight={mine ? 'fill' : 'regular'} aria-hidden />
                {count > 0 && count}
              </button>
            );
          })}
        </div>
      )}
      {!post.scheduled && (
        <PostComments
          comments={post.comments}
          canComment={post.canComment}
          disabledNote={commentsNote}
          onAdd={(text) => run(() => addComment(path, post.id, text))}
          onDelete={removeComment}
        />
      )}
    </li>
  );
}
