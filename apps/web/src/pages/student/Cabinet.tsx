import { Link } from 'react-router-dom';
import { PaintBrushIcon } from '@phosphor-icons/react';
import { api, type Profile } from '../../api';
import { ProfileView } from '../../components/ProfileView';
import { ErrorBox, Skeleton } from '../../components/ui';
import { useLoad } from '../../hooks';

export function ProfileSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" role="status" aria-label="Загрузка">
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

export function CabinetPage() {
  const { data, error, reload } = useLoad(() => api<Profile>('GET', '/student/profile'), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <ProfileSkeleton />;
  return (
    <ProfileView
      profile={data}
      isOwn
      actions={
        <Link to="/hero" className="btn btn-primary">
          <PaintBrushIcon size={20} weight="bold" /> Собрать героя
        </Link>
      }
    />
  );
}
