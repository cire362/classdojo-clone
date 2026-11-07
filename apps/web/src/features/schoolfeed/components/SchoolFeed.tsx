import { useEffect } from 'react';
import { MegaphoneIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useNotifications } from '../../notifications';
import { fetchSchoolFeed } from '../api';
import { SchoolPostCard } from './SchoolPostCard';
import { useTerms } from '../../auth';

/** Новости школы для преподавателя и родителя. Открытие ленты отмечает её прочитанной */
export function SchoolFeed() {
  const { data, error, reload } = useLoad(() => fetchSchoolFeed(), []);
  const { refresh } = useNotifications();
  const t = useTerms();
  useEffect(() => {
    if (data) void refresh();
  }, [data, refresh]);
  const severalSchools = new Set(data?.map((p) => p.schoolName)).size > 1;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl sm:text-3xl">Новости {t.org.one.gen}</h1>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && data.length === 0 && (
        <div
          className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line px-6 py-10 sm:items-center sm:text-center"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-accent/25 text-ink">
            <MegaphoneIcon size={40} aria-hidden />
          </span>
          <h2 className="text-lg">Новостей пока нет</h2>
          <p className="max-w-[46ch] text-ink-soft">Здесь появятся объявления и новости от администрации {t.org.one.gen}.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-4" aria-label={`Записи ${t.org.one.gen}`}>
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
