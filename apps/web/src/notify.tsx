import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Notifications } from './api';
import { useAuth } from './auth';

const EMPTY: Notifications = { messages: 0, feed: 0 };
const POLL_MS = 60_000;

interface NotifyState {
  counts: Notifications;
  refresh: () => Promise<void>;
}

const NotifyContext = createContext<NotifyState>({ counts: EMPTY, refresh: async () => undefined });

/**
 * Значки новых сообщений и записей в ленте. Обновляются раз в минуту, при возвращении на вкладку
 * и после просмотра ленты или переписки (refresh). Push-уведомлений нет: им нужен HTTPS.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Notifications>(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setCounts(await api<Notifications>('GET', '/notifications'));
    } catch {
      /* счётчики не критичны */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCounts(EMPTY);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refresh]);

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
