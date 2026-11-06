import { MegaphoneIcon } from '@phosphor-icons/react';
import type { FeedPost } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { useNotifications } from '../../notifications';
import { useToast } from '../../../ui/Toast';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { deletePost, fetchPosts } from '../api';
import { PostCard } from './PostCard';
import { PostForm } from './PostForm';

/**
 * Лента класса. С postTo — форма для преподавателя (адрес публикации). moderation — скрытие записей
 * преподавателем; refreshKey перечитывает ленту, когда её поменяли в панели жалоб
 */
export function Feed({ path, postTo, noPhotoNames, readOnlyNote, commentsNote, moderation, refreshKey, onLoaded }: {
  path: string;
  postTo?: string;
  noPhotoNames?: string[];
  readOnlyNote?: string;
  commentsNote?: string;
  moderation?: { groupId: string; onDecided: () => void };
  refreshKey?: number;
  onLoaded?: () => void;
}) {
  const toast = useToast();
  const { refresh } = useNotifications();
  const { data, setData, error, reload } = useLoad(async () => {
    const posts = await fetchPosts(path);
    void refresh();
    onLoaded?.();
    return posts;
  }, [path, refreshKey]);

  async function remove(post: FeedPost) {
    try {
      await deletePost(post.id);
      drop(post);
      moderation?.onDecided();
      toast({ text: 'Запись удалена', tone: 'neutral' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }
  const drop = (post: FeedPost) => setData((current) => current && current.filter((p) => p.id !== post.id));
  const change = (post: FeedPost) => setData((current) => current && current.map((p) => (p.id === post.id ? post : p)));

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="sr-only">Лента класса</h2>
      {postTo && (
        <PostForm postTo={postTo} noPhotoNames={noPhotoNames} onPosted={(post) => setData((current) => [post, ...(current ?? [])])} />
      )}
      {readOnlyNote && <p className="text-sm text-ink-soft">{readOnlyNote}</p>}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-32" />}
      {data?.length === 0 && (
        <EmptyState icon={<MegaphoneIcon size={28} />} title="Пока без объявлений">
          {postTo
            ? 'Здесь появятся ваши объявления для учеников и родителей.'
            : 'Когда преподаватель напишет объявление, оно появится здесь.'}
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              path={path}
              commentsNote={commentsNote}
              moderation={moderation}
              onChange={change}
              onDelete={remove}
              onRemove={drop}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
