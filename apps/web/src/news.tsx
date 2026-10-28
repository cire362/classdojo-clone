import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type StudentNews } from './api';
import { useAuth } from './auth';

interface NewsState {
  news: StudentNews | null;
  reload: () => Promise<void>;
  markSeen: (kind: 'level' | 'parts') => Promise<void>;
}

const NewsContext = createContext<NewsState>({ news: null, reload: async () => undefined, markSeen: async () => undefined });

/** Новости ученика (новый уровень, новые детали) — общие для шапки, кабинета и конструктора */
export function NewsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [news, setNews] = useState<StudentNews | null>(null);
  const isStudent = user?.role === 'STUDENT';

  const reload = useCallback(async () => {
    if (!isStudent) return;
    try {
      setNews(await api<StudentNews>('GET', '/student/news'));
    } catch {
      /* новости не критичны для работы страницы */
    }
  }, [isStudent]);

  const markSeen = useCallback(async (kind: 'level' | 'parts') => {
    try {
      setNews(await api<StudentNews>('POST', '/student/news/seen', { kind }));
    } catch {
      /* повторим при следующем заходе */
    }
  }, []);

  useEffect(() => {
    if (isStudent) void reload();
    else setNews(null);
  }, [isStudent, reload]);

  return <NewsContext.Provider value={{ news, reload, markSeen }}>{children}</NewsContext.Provider>;
}

export const useNews = () => useContext(NewsContext);
