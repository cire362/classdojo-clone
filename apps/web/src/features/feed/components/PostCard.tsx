import { useState } from 'react';
import { ClockIcon, EyeIcon, EyeSlashIcon, FlagIcon, HeartIcon, PushPinIcon, PushPinSlashIcon, StarIcon, ThumbsUpIcon, TrashIcon }
  from '@phosphor-icons/react';
import { REACTION_KINDS, type ReactionKind, type ReportReason } from '@heroes/shared';
import type { FeedComment, FeedPost } from '../../../lib/api';
import { formatDateTime } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import { ReportModal, reportContent, setHidden } from '../../moderation';
import { addComment, deleteComment, setPinned, setReaction } from '../api';
import { PostComments } from './PostComments';
import { PostMedia } from './PostMedia';
import { useTerms } from '../../auth';

const REACTIONS: Record<ReactionKind, { label: string; icon: typeof HeartIcon }> = {
  like: { label: 'Нравится', icon: ThumbsUpIcon },
  heart: { label: 'С любовью', icon: HeartIcon },
  star: { label: 'Отлично', icon: StarIcon },
};

/**
 * moderation: группа, в которой преподаватель скрывает записи и комментарии; onDecided сообщает панели жалоб,
 * что очередь изменилась. onRemove убирает запись из списка без удаления: её скрыла жалоба
 */
export function PostCard({ post, path, commentsNote, moderation, onChange, onDelete, onRemove }: {
  post: FeedPost;
  path: string;
  commentsNote?: string;
  moderation?: { groupId: string; onDecided: () => void };
  onChange: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
  onRemove: (post: FeedPost) => void;
}) {
  const t = useTerms();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState<{ commentId?: string } | null>(null);

  async function run(request: () => Promise<FeedPost | null>) {
    if (busy) return false;
    setBusy(true);
    try {
      const updated = await request();
      if (updated) onChange(updated);
      else onRemove(post);
      return true;
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const react = (kind: ReactionKind) => run(() => setReaction(path, post.id, post.myReaction === kind ? null : kind));
  const removeComment = (comment: FeedComment) =>
    run(async () => {
      const updated = await deleteComment(path, post.id, comment.id);
      moderation?.onDecided();
      return updated;
    });
  const toggleHidden = (target: 'post' | 'comment', id: string, hidden: boolean) =>
    run(async () => {
      await setHidden(moderation!.groupId, target, id, hidden);
      moderation!.onDecided();
      if (target === 'post') return { ...post, hidden, reports: 0 };
      return { ...post, comments: post.comments.map((c) => (c.id === id ? { ...c, hidden, reports: 0 } : c)) };
    });
  async function report(reason: ReportReason, note: string) {
    let hiddenNow = false;
    const ok = await run(async () => {
      const { post: updated } = await reportContent(path, post.id, { reason, note, commentId: reporting?.commentId });
      hiddenNow = !updated;
      return updated;
    });
    if (ok) {
      setReporting(null);
      const next = hiddenNow ? 'Запись скрыта до решения преподавателя' : 'Преподаватель разберётся';
      toast({ text: `Жалоба отправлена. ${next}`, tone: 'ok' });
    }
    return ok;
  }

  return (
    <li className={`card p-4 ${post.pinned ? 'ring-2 ring-accent' : ''} ${post.hidden ? 'border-dashed' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm text-ink-soft">
          <span className="font-semibold text-ink">{post.author}</span> · {formatDateTime(post.createdAt)}
          {post.pinned && <span className="chip ml-2 bg-accent text-xs text-on-accent">Закреплено</span>}
          {post.scheduled && (
            <span className="chip ml-2 bg-surface-2 text-xs text-ink">
              <ClockIcon size={14} aria-hidden /> Выйдет в это время
            </span>
          )}
          {post.hidden && <span className="chip ml-2 bg-minus-bg text-xs text-minus">Скрыта от {t.student.many.gen} и родителей</span>}
          {post.reports > 0 && (
            <span className="chip ml-2 bg-minus-bg text-xs text-minus">
              <FlagIcon size={14} aria-hidden /> Жалобы: {post.reports}
            </span>
          )}
          {post.reported && <span className="chip ml-2 bg-surface-2 text-xs text-ink">Вы пожаловались</span>}
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0">
          {post.canModerate && moderation && (
            <button
              className="icon-btn"
              title={post.hidden ? 'Показать' : 'Скрыть'}
              aria-label={post.hidden ? 'Показать запись' : 'Скрыть запись'}
              onClick={() => toggleHidden('post', post.id, !post.hidden)}
            >
              {post.hidden ? <EyeIcon size={18} /> : <EyeSlashIcon size={18} />}
            </button>
          )}
          {post.canReport && (
            <button className="icon-btn" title="Пожаловаться" aria-label="Пожаловаться на запись" onClick={() => setReporting({})}>
              <FlagIcon size={18} />
            </button>
          )}
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
      <PostMedia media={post.media} />
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
          onReport={(c) => setReporting({ commentId: c.id })}
          onToggleHidden={moderation && post.canModerate ? (c) => toggleHidden('comment', c.id, !c.hidden) : undefined}
        />
      )}
      <ReportModal
        open={!!reporting}
        target={reporting?.commentId ? 'comment' : 'post'}
        onClose={() => setReporting(null)}
        onSubmit={report}
      />
    </li>
  );
}
