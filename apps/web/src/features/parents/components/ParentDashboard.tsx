import { useState } from 'react';
import { DownloadSimpleIcon, UsersIcon } from '@phosphor-icons/react';
import { exportUrl } from '../../../lib/files';
import type { ParentChild } from '../../../lib/api';
import { Feed } from '../../feed';
import { Thread, fetchChildMessages, fetchParentNotice, sendChildMessage } from '../../messages';
import { CountBadge, useNotifications } from '../../notifications';
import { HeroHead } from '../../hero';
import { ProfileView } from '../../profile';
import { WeeklySummary } from '../../profile';
import { ParentRewards } from '../../rewards';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { useLoad } from '../../../lib/hooks';
import { ProfileSkeleton } from '../../profile';
import { Calendar } from '../../calendar';
import { ParentAssignments } from '../../assignments';
import { HomePoints } from '../../home';
import { fetchChildProfile, fetchChildren } from '../api';
import { HeroesProvider, useTerms } from '../../auth';

/** Выбранный ребёнок запоминается: его профиль ранний скрипт запрашивает сразу при открытии */
export const CHILD_KEY = 'heroes:child';

function storedChild(): string | null {
  try {
    return localStorage.getItem(CHILD_KEY);
  } catch {
    return null;
  }
}

/** Кабинет родителя: школьные данные своих детей только для просмотра, домашние баллы родитель ведёт сам */
export function ParentDashboard() {
  const t = useTerms();
  const children = useLoad(() => fetchChildren(), []);
  const [selected, setSelected] = useState<string | null>(storedChild);
  const [section, setSection] = useState<'profile' | 'week' | 'rewards' | 'home' | 'assignments' | 'feed' | 'calendar' | 'messages'>(
    'profile',
  );
  const list = children.data ?? [];
  const current = list.find((c) => c.id === selected) ?? list[0];
  const profile = useLoad(
    () => (current ? fetchChildProfile(current.id) : Promise.resolve(null)),
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
        Преподаватель ещё не привязал к этому входу ни одного {t.student.one.gen}.
      </EmptyState>
    );
  }
  const allSections = [
    ['profile', 'Профиль', 0],
    ['week', 'Итог недели', 0],
    ['rewards', 'Награды', 0],
    ['home', 'Дома', 0],
    ['assignments', 'Задания', 0],
    ['feed', `Лента ${t.group.one.gen}`, current?.unread.feed ?? 0],
    ['calendar', 'Календарь', 0],
    ['messages', 'Сообщения', current?.unread.messages ?? 0],
  ] as const;
  // Без героев в группе ребёнка нет и магазина наград
  const sections = allSections.filter(([key]) => key !== 'rewards' || current?.heroes !== false);
  return (
    <div className="space-y-6">
      {/* В профиле заголовок первого уровня — имя героя */}
      {current && section !== 'profile' && (
        <h1 className="sr-only">{current.name}: {sections.find(([key]) => key === section)?.[1]}</h1>
      )}
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
          {sections.map(([key, label, count]) => (
            <button key={key} className={`tab ${section === key ? 'active' : ''}`} aria-current={section === key ? 'page' : undefined} onClick={() => setSection(key)}>
              {label}
              <CountBadge count={count} label="новых" />
            </button>
          ))}
        </nav>
      )}
      {current && section === 'feed' && (
        <div className="max-w-2xl space-y-4">
          {/* Фото ленты и вложения переписки одним архивом: можно сохранить себе до того, как файлы удалят */}
          <a className="btn btn-secondary btn-sm" href={exportUrl(`/parent/children/${current.id}`)} download>
            <DownloadSimpleIcon size={18} aria-hidden /> Скачать фото и файлы
          </a>
          <Feed
            key={current.id}
            path={`/parent/children/${current.id}/feed`}
            commentsNote="Комментарии сейчас закрыты."
            onLoaded={() => void children.reload()}
            readOnlyNote={`Объявления преподавателей группы ${current.groupName}.`}
          />
        </div>
      )}
      {current && section === 'assignments' && <ParentAssignments key={current.id} childId={current.id} />}
      {current && section === 'calendar' && <Calendar key={current.id} path={`/parent/children/${current.id}/events`} />}
      {current && section === 'messages' && <ParentMessages key={current.id} child={current} onRead={children.reload} />}
      {current && section === 'week' && <WeeklySummary key={current.id} child={current} />}
      {current && current.heroes && section === 'rewards' && <ParentRewards key={current.id} childId={current.id} />}
      {current && section === 'home' && <HomePoints key={current.id} path={`/parent/children/${current.id}/home`} editable />}
      {section === 'profile' &&
        (profile.error ? (
          <ErrorBox message={profile.error} onRetry={profile.reload} />
        ) : profile.data && profile.data.student.id === current?.id ? (
          <HeroesProvider on={current.heroes}>
            <ProfileView profile={profile.data} isOwn={false} />
          </HeroesProvider>
        ) : (
          <ProfileSkeleton />
        ))}
    </div>
  );
}

/** Переписка с преподавателями группы о ребёнке */
function ParentMessages({ child, onRead }: { child: ParentChild; onRead: () => Promise<void> }) {
  const { refresh } = useNotifications();
  const { data, error, reload } = useLoad(async () => {
    const list = await fetchChildMessages(child.id);
    void refresh();
    void onRead();
    return list;
  }, [child.id]);
  const notice = useLoad(() => fetchParentNotice(child.id), [child.id]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-60 max-w-2xl" />;
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-ink-soft">Сообщения видят все преподаватели группы {child.groupName}.</p>
      {notice.data?.quietUntil && (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
          Сейчас у преподавателей тихие часы. Написать можно, ответ будет после {notice.data.quietUntil}.
        </p>
      )}
      <Thread
        messages={data}
        emptyText="Здесь можно написать преподавателю: о пропуске, успехах или вопросе. Можно приложить фото или PDF."
        send={(message) => sendChildMessage(child.id, message)}
      />
    </div>
  );
}
