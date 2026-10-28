import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Me } from './api';

interface AuthState {
  user: Me | null;
  loading: boolean;
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
    else localStorage.removeItem(ROLE_KEY);
  } catch {
    /* хранилище недоступно — просто без ускорения */
  }
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: Me | null }>('GET', '/auth/me')
      .then((r) => {
        setUser(r.user);
        rememberRole(r.user?.role ?? null);
      })
      .catch(() => setUser(null))
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
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
