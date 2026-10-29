import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { PaintBrushIcon, SparkleIcon } from '@phosphor-icons/react';
import { api, type Profile } from '../../api';
import { PartPreview } from '../../components/PartPreview';
import { ProfileView } from '../../components/ProfileView';
import { ErrorBox, Skeleton } from '../../components/ui';
import { pluralize, useLoad } from '../../hooks';
import { useNews } from '../../news';

// Праздник уровня с конфетти бывает редко и тянет библиотеку анимаций — грузим его только когда он нужен
const LevelUpOverlay = lazy(() => import('../../components/LevelUp').then((m) => ({ default: m.LevelUpOverlay })));

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

export function CabinetPage() {
  const { data, error, reload } = useLoad(() => api<Profile>('GET', '/student/profile'), []);
  const { news, markSeen } = useNews();
  // Окно остаётся смонтированным после закрытия, чтобы доиграла анимация ухода
  const [levelUpUsed, setLevelUpUsed] = useState(false);
  if (news?.levelUp && !levelUpUsed) setLevelUpUsed(true);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <ProfileSkeleton />;

  const newIds = news?.newPartIds ?? [];
  return (
    <div className="space-y-6">
      {newIds.length > 0 && !news?.levelUp && (
        <Link
          to="/hero"
          className="card flex flex-wrap items-center gap-4 border-accent/60 bg-accent/15 p-4 transition hover:shadow-[var(--shadow-pop)] sm:flex-nowrap"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <SparkleIcon size={26} weight="fill" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {pluralize(newIds.length, 'Открылась', 'Открылись', 'Открылось')} {newIds.length}{' '}
              {pluralize(newIds.length, 'новая деталь', 'новые детали', 'новых деталей')}
            </span>
            <span className="block text-sm text-ink-soft">Загляни в конструктор и примерь их на своего героя.</span>
          </span>
          <span className="hidden gap-2 md:flex" aria-hidden>
            {newIds.slice(0, 4).map((id) => (
              <PartPreview key={id} partId={id} base={data.hero.parts} className="w-16 [&_figcaption]:hidden" />
            ))}
          </span>
          <span className="btn btn-primary w-full sm:w-auto">В конструктор</span>
        </Link>
      )}

      <ProfileView
        profile={data}
        isOwn
        actions={
          <Link to="/hero" className="btn btn-primary">
            <PaintBrushIcon size={20} weight="bold" /> Собрать героя
          </Link>
        }
      />

      {levelUpUsed && (
        <Suspense fallback={null}>
          <LevelUpOverlay
            open={!!news?.levelUp}
            level={news?.levelUp?.to ?? 1}
            hero={data.hero.parts}
            newPartIds={newIds}
            onClose={() => void markSeen('level')}
          />
        </Suspense>
      )}
    </div>
  );
}
