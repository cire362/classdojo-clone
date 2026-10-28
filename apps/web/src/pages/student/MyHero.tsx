import { api, type Hero, type Profile } from '../../api';
import { HeroEditor } from '../../components/HeroEditor';
import { ErrorBox, Skeleton } from '../../components/ui';
import { useLoad } from '../../hooks';

export function MyHeroPage() {
  const { data, setData, error, reload } = useLoad(() => api<Profile>('GET', '/student/profile'), []);
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
        onSave={async (name, parts) => {
          const hero = await api<Hero>('PUT', '/student/hero', { name, parts });
          setData({ ...data, hero });
        }}
      />
    </div>
  );
}
