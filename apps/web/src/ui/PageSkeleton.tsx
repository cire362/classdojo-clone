import { Skeleton } from './index';

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6" role="status" aria-label="Загрузка">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48" />
    </div>
  );
}
