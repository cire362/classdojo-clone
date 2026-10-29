import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, api, type Me } from './api';

interface AuthState {
  user: Me | null;
  loading: boolean;
  /** Не удалось проверить вход из-за связи: показываем «Нет связи», а не страницу входа */
  offline: boolean;
  login: (login: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  /** Перечитать данные пользователя (после смены имени) */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Роль запоминается в браузере только для ускорения: по ней src/early.ts заранее
// запрашивает данные главной страницы
const ROLE_KEY = 'heroes:role';

function rememberRole(role: string | null) {
  try {
    if (role) localStorage.setItem(ROLE_KEY, role);
    else {
      localStorage.removeItem(ROLE_KEY);
      // Выбранный ребёнок в кабинете родителя — тоже только для ускорения
      localStorage.removeItem('heroes:child');
    }
  } catch {
    /* хранилище недоступно — просто без ускорения */
  }
}

export function storedRole(): string | null {
  try {
    return localStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api<{ user: Me | null }>('GET', '/auth/me')
      .then((r) => {
        setUser(r.user);
        rememberRole(r.user?.role ?? null);
      })
      .catch((e) => {
        setUser(null);
        if (e instanceof ApiError && e.status === 0) setOffline(true);
      })
      .finally(() => setLoading(false));
    const onUnauthorized = () => setUser(null);
    window.addEventListener('heroes:unauthorized', onUnauthorized);
    return () => window.removeEventListener('heroes:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (login: string, password: string) => {
    const r = await api<{ user: Me }>('POST', '/auth/login', { login, password });
    setUser(r.user);
    rememberRole(r.user.role);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    await api('POST', '/auth/logout').catch(() => undefined);
    setUser(null);
    rememberRole(null);
  }, []);

  const refresh = useCallback(async () => {
    const r = await api<{ user: Me | null }>('GET', '/auth/me');
    setUser(r.user);
    setOffline(false);
  }, []);

  return <AuthContext.Provider value={{ user, loading, offline, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
