import { Skeleton } from '../../../ui';

/** Заглушка профиля: кабинет ученика, карточка у преподавателя и кабинет родителя */
export function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" role="status" aria-label="Загрузка">
      <Skeleton className="aspect-[5/6] max-h-[420px]" />
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-28" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </div>
  );
}
