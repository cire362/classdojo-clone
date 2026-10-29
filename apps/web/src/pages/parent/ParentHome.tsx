import { useState } from 'react';
import { UsersIcon } from '@phosphor-icons/react';
import { api, type ParentChild, type Profile } from '../../api';
import { HeroHead } from '../../components/HeroAvatar';
import { ProfileView } from '../../components/ProfileView';
import { EmptyState, ErrorBox } from '../../components/ui';
import { useLoad } from '../../hooks';
import { ProfileSkeleton } from '../student/Cabinet';

/** Выбранный ребёнок запоминается: его профиль ранний скрипт запрашивает сразу при открытии */
export const CHILD_KEY = 'heroes:child';

function storedChild(): string | null {
  try {
    return localStorage.getItem(CHILD_KEY);
  } catch {
    return null;
  }
}

/** Кабинет родителя: герой, баллы, история и посещаемость своих детей — только просмотр */
export function ParentHomePage() {
  const children = useLoad(() => api<ParentChild[]>('GET', '/parent/children'), []);
  const [selected, setSelected] = useState<string | null>(storedChild);
  const list = children.data ?? [];
  const current = list.find((c) => c.id === selected) ?? list[0];
  const profile = useLoad(
    () => (current ? api<Profile>('GET', `/parent/children/${current.id}/profile`) : Promise.resolve(null)),
    [current?.id],
  );

  function choose(id: string) {
    setSelected(id);
    try {
      localStorage.setItem(CHILD_KEY, id);
    } catch {
      // без сохранения выбора
    }
  }

  if (children.error) return <ErrorBox message={children.error} onRetry={children.reload} />;
  if (children.data && !list.length) {
    return (
      <EmptyState icon={<UsersIcon size={28} />} title="Пока здесь никого нет">
        Преподаватель ещё не привязал к этому входу ни одного ученика.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-6">
      {list.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Дети">
          {list.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === current?.id}
              className={`inline-flex min-h-12 items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-semibold transition ${
                c.id === current?.id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:bg-surface-2'
              }`}
              onClick={() => choose(c.id)}
            >
              <HeroHead parts={c.hero.parts} className="size-10" />
              {c.name}
            </button>
          ))}
        </div>
      )}
      {profile.error ? (
        <ErrorBox message={profile.error} onRetry={profile.reload} />
      ) : profile.data && profile.data.student.id === current?.id ? (
        <ProfileView profile={profile.data} isOwn={false} />
      ) : (
        <ProfileSkeleton />
      )}
    </div>
  );
}
