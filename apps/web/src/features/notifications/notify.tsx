import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type Notifications } from '../../lib/api';
import { useAuth } from '../auth';

const EMPTY: Notifications = { messages: 0, feed: 0, rewards: 0, works: 0 };
const POLL_MS = 60_000;

interface NotifyState {
  counts: Notifications;
  refresh: () => Promise<void>;
}

const NotifyContext = createContext<NotifyState>({ counts: EMPTY, refresh: async () => undefined });

/**
 * Значки сообщений, ленты и наград (для преподавателя — ожидающие запросы). Обновляются раз в минуту,
 * при возвращении на вкладку и после просмотра раздела (refresh).
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const login = user?.login;
  const [state, setState] = useState<{ login?: string; counts: Notifications }>({ counts: EMPTY });
  const currentLogin = useRef(login);
  currentLogin.current = login;
  const sequence = useRef(0);
  const counts = state.login === login ? state.counts : EMPTY;

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    if (!login) return;
    try {
      const counts = await api<Notifications>('GET', '/notifications');
      // Старый запрос после смены аккаунта или прочтения не возвращает чужие/устаревшие счётчики.
      if (currentLogin.current === login && sequence.current === request) setState({ login, counts });
    } catch {
      /* счётчики не критичны */
    }
  }, [login]);

  useEffect(() => {
    if (!login) return;
    void refresh();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [login, refresh]);

  return <NotifyContext.Provider value={{ counts, refresh }}>{children}</NotifyContext.Provider>;
}

export const useNotifications = () => useContext(NotifyContext);

/** Круглый значок со счётчиком; для экранного диктора — текст */
export function CountBadge({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <span className="chip min-w-6 justify-center bg-accent px-1.5 text-xs text-on-accent">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}
