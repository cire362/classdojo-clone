import { useEffect } from 'react';
import { MegaphoneIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { useNotifications } from '../../notifications';
import { fetchSchoolFeed } from '../api';
import { SchoolPostCard } from './SchoolPostCard';

/** Новости школы для преподавателя и родителя. Открытие ленты отмечает её прочитанной */
export function SchoolFeed() {
  const { data, error, reload } = useLoad(() => fetchSchoolFeed(), []);
  const { refresh } = useNotifications();
  useEffect(() => {
    if (data) void refresh();
  }, [data, refresh]);
  const severalSchools = new Set(data?.map((p) => p.schoolName)).size > 1;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl sm:text-3xl">Новости школы</h1>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && data.length === 0 && (
        <EmptyState icon={<MegaphoneIcon size={40} aria-hidden />} title="Новостей пока нет">
          Здесь появятся объявления и новости от администрации школы.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-4" aria-label="Записи школы">
          {data.map((post) => (
            <li key={post.id}>
              <SchoolPostCard post={post} level={2} isNew={post.unread} schoolName={severalSchools ? post.schoolName : undefined} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
