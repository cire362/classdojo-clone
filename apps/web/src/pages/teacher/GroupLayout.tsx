import { Suspense, type Dispatch, type SetStateAction } from 'react';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { ChunkErrorBoundary } from '../../components/ChunkErrorBoundary';
import { ArchiveIcon, ArrowLeftIcon, CameraIcon, ChartBarIcon, GiftIcon, ListChecksIcon, MegaphoneIcon, SparkleIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { api, type GroupDetails } from '../../api';
import { CardGridSkeleton, ErrorBox, Skeleton } from '../../components/ui';
import { pluralize, useLoad } from '../../hooks';

export interface GroupCtx {
  data: GroupDetails;
  setData: Dispatch<SetStateAction<GroupDetails | null>>;
  reload: () => Promise<void>;
}

export const useGroup = () => useOutletContext<GroupCtx>();

const TABS = [
  { to: '', end: true, label: 'Урок', icon: SparkleIcon },
  { to: 'attendance', label: 'Отметка', icon: CameraIcon },
  { to: 'students', label: 'Ученики', icon: UsersThreeIcon },
  { to: 'reasons', label: 'Причины', icon: ListChecksIcon },
  { to: 'stats', label: 'Статистика', icon: ChartBarIcon },
  { to: 'rewards', label: 'Награды', icon: GiftIcon },
  { to: 'feed', label: 'Лента', icon: MegaphoneIcon },
];

export function GroupLayout() {
  const { groupId } = useParams();
  const location = useLocation();
  const { data, setData, error, loading, reload } = useLoad(
    () => api<GroupDetails>('GET', `/teacher/groups/${groupId}`),
    [groupId],
  );

  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="icon-btn -ml-2" aria-label="Все группы">
            <ArrowLeftIcon size={22} />
          </Link>
          {data ? <h1 className="truncate text-2xl sm:text-3xl">{data.group.name}</h1> : <Skeleton className="h-9 w-48" />}
        </div>
        {data?.group.archivedAt && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
            <ArchiveIcon size={22} className="shrink-0" />
            <p className="min-w-0 flex-1 text-sm">
              <b>Группа в архиве</b> с {new Date(data.group.archivedAt).toLocaleDateString('ru-RU')}. Статистика, профили и
              Excel доступны, а начислять баллы и отмечать посещаемость нельзя.
            </p>
            {data.group.isOwner && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  await api('POST', `/teacher/groups/${data.group.id}/restore`);
                  await reload();
                }}
              >
                Вернуть из архива
              </button>
            )}
          </div>
        )}
        <nav
          aria-label="Разделы группы"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          {TABS.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={label} to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
              <Icon size={18} weight="bold" />
              {label}
              {to === 'rewards' && data && data.pendingRewards > 0 && (
                <span className="chip min-w-6 justify-center bg-accent px-1.5 text-xs text-on-accent">
                  {data.pendingRewards}
                  <span className="sr-only"> {pluralize(data.pendingRewards, 'запрос', 'запроса', 'запросов')}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      {loading && !data ? (
        <CardGridSkeleton />
      ) : (
        data && (
          <ChunkErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<CardGridSkeleton />}>
              <Outlet context={{ data, setData, reload } satisfies GroupCtx} />
            </Suspense>
          </ChunkErrorBoundary>
        )
      )}
    </div>
  );
}
