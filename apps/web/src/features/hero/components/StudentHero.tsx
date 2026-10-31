import { useEffect, useState } from 'react';
import { api, type Hero, type Profile } from '../../../lib/api';
import { HeroEditor } from '..';
import { ErrorBox, Skeleton } from '../../../ui';
import { useLoad } from '../../../lib/hooks';
import { useNews } from '../../news';

export function StudentHero() {
  const { data, setData, error, reload } = useLoad(() => api<Profile>('GET', '/student/profile'), []);
  const { news, markSeen } = useNews();
  // Запоминаем новые детали на время визита: метки «новое» видны, пока ученик в конструкторе
  const [newIds, setNewIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!news || newIds) return;
    setNewIds(new Set(news.newPartIds));
    if (news.newPartIds.length) void markSeen('parts');
  }, [news, newIds, markSeen]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-[520px]" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Конструктор героя</h1>
        <p className="mt-2 text-ink-soft">
          Твой уровень: {data.level.level}. Новые детали открываются с уровнем.
        </p>
      </div>
      <HeroEditor
        key={data.student.id}
        initial={data.hero}
        level={data.level.level}
        premium={data.premium}
        newIds={newIds ?? undefined}
        onSave={async (name, parts) => {
          const hero = await api<Hero>('PUT', '/student/hero', { name, parts });
          setData({ ...data, hero });
        }}
      />
    </div>
  );
}
