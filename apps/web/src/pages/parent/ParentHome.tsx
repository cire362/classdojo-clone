import { useState } from 'react';
import { UsersIcon } from '@phosphor-icons/react';
import { api, type ChatMessage, type ParentChild, type Profile } from '../../api';
import { Feed } from '../../components/Feed';
import { Thread } from '../../components/Thread';
import { CountBadge, useNotifications } from '../../notify';
import { HeroHead } from '../../components/HeroAvatar';
import { ProfileView } from '../../components/ProfileView';
import { WeeklySummary } from '../../components/WeeklySummary';
import { ParentRewards } from '../../components/ParentRewards';
import { EmptyState, ErrorBox, Skeleton } from '../../ui';
import { useLoad } from '../../hooks';
import { ProfileSkeleton } from '../../features/profile';

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
  const [section, setSection] = useState<'profile' | 'week' | 'rewards' | 'feed' | 'messages'>('profile');
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
              <CountBadge count={c.unread.messages + c.unread.feed} label="новых" />
            </button>
          ))}
        </div>
      )}
      {current && (
        <nav className="flex gap-1 overflow-x-auto" aria-label="Разделы">
          {(
            [
              ['profile', 'Профиль', 0],
              ['week', 'Итог недели', 0],
              ['rewards', 'Награды', 0],
              ['feed', 'Лента класса', current.unread.feed],
              ['messages', 'Сообщения', current.unread.messages],
            ] as const
          ).map(([key, label, count]) => (
            <button key={key} className={`tab ${section === key ? 'active' : ''}`} aria-current={section === key ? 'page' : undefined} onClick={() => setSection(key)}>
              {label}
              <CountBadge count={count} label="новых" />
            </button>
          ))}
        </nav>
      )}
      {current && section === 'feed' && (
        <Feed key={current.id} path={`/parent/children/${current.id}/feed`} onLoaded={() => void children.reload()} readOnlyNote={`Объявления преподавателей группы ${current.groupName}.`} />
      )}
      {current && section === 'messages' && <ParentMessages key={current.id} child={current} onRead={children.reload} />}
      {current && section === 'week' && <WeeklySummary key={current.id} child={current} />}
      {current && section === 'rewards' && <ParentRewards key={current.id} childId={current.id} />}
      {section === 'profile' &&
        (profile.error ? (
          <ErrorBox message={profile.error} onRetry={profile.reload} />
        ) : profile.data && profile.data.student.id === current?.id ? (
          <ProfileView profile={profile.data} isOwn={false} />
        ) : (
          <ProfileSkeleton />
        ))}
    </div>
  );
}

/** Переписка с преподавателями группы о ребёнке */
function ParentMessages({ child, onRead }: { child: ParentChild; onRead: () => Promise<void> }) {
  const { refresh } = useNotifications();
  const path = `/parent/children/${child.id}/messages`;
  const { data, error, reload } = useLoad(async () => {
    const list = await api<ChatMessage[]>('GET', path);
    void refresh();
    void onRead();
    return list;
  }, [path]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-60 max-w-2xl" />;
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-ink-soft">Сообщения видят все преподаватели группы {child.groupName}.</p>
      <Thread messages={data} emptyText="Здесь можно написать преподавателю: о пропуске, успехах или вопросе." send={(text) => api<ChatMessage[]>('POST', path, { text })} />
    </div>
  );
}
