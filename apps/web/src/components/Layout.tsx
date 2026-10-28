import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { SignOutIcon, StarIcon } from '@phosphor-icons/react';
import { useAuth } from '../auth';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-on-accent">
        <StarIcon size={20} weight="fill" />
      </span>
      {!compact && <span className="font-display text-[17px] font-semibold tracking-tight">Герои класса</span>}
    </span>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navClass = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? 'active' : ''}`;
  return (
    <div className="min-h-[100dvh]">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="На главную">
            <Logo />
          </Link>
          {user?.role === 'STUDENT' && (
            <nav className="ml-2 hidden gap-1 sm:flex" aria-label="Разделы">
              <NavLink to="/" end className={navClass}>
                Мой герой
              </NavLink>
              <NavLink to="/hero" className={navClass}>
                Конструктор
              </NavLink>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden max-w-[22ch] truncate text-sm font-medium text-ink-soft sm:block">{user?.name}</span>
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
          <nav className="mx-auto flex max-w-7xl gap-1 px-4 pb-2 sm:hidden" aria-label="Разделы">
            <NavLink to="/" end className={navClass}>
              Мой герой
            </NavLink>
            <NavLink to="/hero" className={navClass}>
              Конструктор
            </NavLink>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
