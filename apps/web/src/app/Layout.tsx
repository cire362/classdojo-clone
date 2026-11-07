import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChunkErrorBoundary } from '../ui/ChunkErrorBoundary';
import { BellIcon, ChatsCircleIcon, GearSixIcon, GiftIcon, MegaphoneIcon, SignOutIcon, StarIcon } from '@phosphor-icons/react';
import { useAuth } from '../features/auth';
import { useNews } from '../features/news';
import { CountBadge, useNotifications } from '../features/notifications';
import { pluralize } from '../lib/hooks';
import { Skeleton } from '../ui';

export function Logo({ compact = false, hideNameOnMobile = false }: { compact?: boolean; hideNameOnMobile?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-on-accent">
        <StarIcon size={20} weight="fill" />
      </span>
      {!compact && <span className={`font-display text-[17px] font-semibold tracking-tight ${hideNameOnMobile ? 'hidden sm:inline' : ''}`}>Герои класса</span>}
    </span>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { news } = useNews();
  const { counts } = useNotifications();
  const navClass = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? 'active' : ''}`;
  const newCount = news?.newPartIds.length ?? 0;
  const heroLink = (
    <NavLink to="/hero" className={navClass}>
      Конструктор
      {newCount > 0 && (
        <span className="chip min-w-6 justify-center bg-accent px-1.5 text-xs text-on-accent">
          {newCount}
          <span className="sr-only"> {pluralize(newCount, 'новая деталь', 'новые детали', 'новых деталей')}</span>
        </span>
      )}
    </NavLink>
  );
  const shopLink = (
    <NavLink to="/shop" className={navClass}>
      Награды
      <CountBadge count={counts.rewards} label={pluralize(counts.rewards, 'выданная награда', 'выданные награды', 'выданных наград')} />
    </NavLink>
  );
  const worksLink = (
    <NavLink to="/works" className={navClass}>
      Мои работы
      <CountBadge count={counts.works} label={pluralize(counts.works, 'новое решение', 'новых решения', 'новых решений')} />
    </NavLink>
  );
  const assignmentsLink = (
    <NavLink to="/assignments" className={navClass}>
      Задания
      <CountBadge count={counts.assignments} label="новых" />
    </NavLink>
  );
  const calendarLink = (
    <NavLink to="/calendar" className={navClass}>
      Календарь
    </NavLink>
  );
  const feedLink = (
    <NavLink to="/feed" className={navClass}>
      Лента
      <CountBadge count={counts.feed} label="новых записей" />
    </NavLink>
  );
  return (
    <div className="min-h-[100dvh]">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="Герои класса — главная">
            <Logo hideNameOnMobile={user?.role === 'TEACHER'} />
          </Link>
          {user?.role === 'STUDENT' && (
            <nav className="ml-2 hidden gap-1 sm:flex" aria-label="Разделы">
              <NavLink to="/" end className={navClass}>
                Мой герой
              </NavLink>
              {heroLink}
              {shopLink}
              {feedLink}
              {worksLink}
              {assignmentsLink}
              {calendarLink}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1">
            {user?.role === 'TEACHER' && (
              <NavLink to="/reward-requests" className={({ isActive }) => `icon-btn relative w-auto gap-1 px-2.5 ${isActive ? 'bg-surface-2 text-ink' : ''}`} title="Запросы наград">
                <GiftIcon size={22} aria-hidden />
                <span className="sr-only">Запросы наград</span>
                <CountBadge count={counts.rewards} label={pluralize(counts.rewards, 'ожидающий запрос', 'ожидающих запроса', 'ожидающих запросов')} />
              </NavLink>
            )}
            {user?.role === 'STUDENT' && (
              <NavLink to="/notifications" className={({ isActive }) => `icon-btn relative w-auto gap-1 px-2.5 ${isActive ? 'bg-surface-2 text-ink' : ''}`} title="Уведомления">
                <BellIcon size={22} aria-hidden />
                <span className="sr-only">Уведомления</span>
                <CountBadge count={counts.feed + counts.rewards} label={pluralize(counts.feed + counts.rewards, 'непрочитанное уведомление', 'непрочитанных уведомления', 'непрочитанных уведомлений')} />
              </NavLink>
            )}
            {(user?.role === 'TEACHER' || user?.role === 'PARENT') && (
              <NavLink
                to="/school"
                className={({ isActive }) => `icon-btn relative w-auto gap-1 px-2.5 ${isActive ? 'bg-surface-2 text-ink' : ''}`}
                title="Новости школы"
              >
                <MegaphoneIcon size={22} aria-hidden />
                <span className="sr-only">Новости школы</span>
                <CountBadge count={counts.school} label="новых записей" />
              </NavLink>
            )}
            {user?.role === 'TEACHER' && (
              <NavLink
                to="/messages"
                className={({ isActive }) => `icon-btn relative w-auto gap-1 px-2.5 ${isActive ? 'bg-surface-2 text-ink' : ''}`}
                title="Сообщения"
              >
                <ChatsCircleIcon size={22} aria-hidden />
                <span className="sr-only">Сообщения</span>
                <CountBadge count={counts.messages} label="новых сообщений" />
              </NavLink>
            )}
            {user?.role === 'TEACHER' ? (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium transition hover:bg-surface-2 hover:text-ink ${
                    isActive ? 'bg-surface-2 text-ink' : 'text-ink-soft'
                  }`
                }
                title="Настройки"
              >
                <span className="hidden max-w-[22ch] truncate sm:block">{user.name}</span>
                <GearSixIcon size={22} aria-hidden />
                <span className="sr-only">Настройки</span>
              </NavLink>
            ) : (
              <span className="hidden max-w-[22ch] truncate text-sm font-medium text-ink-soft sm:block">{user?.name}</span>
            )}
            <button
              className="icon-btn"
              aria-label="Выйти"
              title="Выйти"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <SignOutIcon size={22} />
            </button>
          </div>
        </div>
        {user?.role === 'STUDENT' && (
          <nav className="relative mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:hidden" aria-label="Разделы">
            <NavLink to="/" end className={navClass}>
              Мой герой
            </NavLink>
            {heroLink}
            {shopLink}
            {feedLink}
            {worksLink}
            {assignmentsLink}
            {calendarLink}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <ChunkErrorBoundary resetKey={location.pathname}>
        <Suspense
          fallback={
            <div className="space-y-4" role="status" aria-label="Загрузка">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-48" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
        </ChunkErrorBoundary>
      </main>
    </div>
  );
}
