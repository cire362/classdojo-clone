/**
 * Ранний старт загрузки данных — отдельный крошечный скрипт без зависимостей.
 * Он выполняется сразу после разбора HTML, пока браузер ещё качает React и код страниц,
 * и запрашивает данные открытой страницы. Приложение потом забирает готовые ответы
 * (api.ts → takeEarly). Пути здесь должны совпадать с теми, что запрашивают страницы.
 */
import { pagesFor, type PageKey } from './routes';

type EarlyMap = Map<string, { at: number; response: Promise<Response | null> }>;
const w = window as Window & { __heroesEarly?: EarlyMap };
const early: EarlyMap = (w.__heroesEarly ??= new Map());

function get(path: string) {
  if (early.has(path)) return;
  early.set(path, { at: Date.now(), response: fetch(`/api${path}`, { credentials: 'same-origin' }).catch(() => null) });
}

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function role(): string | null {
  try {
    return localStorage.getItem('heroes:role');
  } catch {
    return null;
  }
}

const path = location.pathname;

// Код открытой страницы заказываем сразу (имена файлов сборки подставляет vite.config.ts)
const chunks = (window as Window & { __heroesChunks?: Partial<Record<PageKey, string[]>> }).__heroesChunks ?? {};
const preloaded = new Set<string>();
for (const key of pagesFor(path)) {
  for (const file of chunks[key] ?? []) {
    if (preloaded.has(file)) continue;
    preloaded.add(file);
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    // Как у Vite: без crossorigin браузер скачал бы модуль второй раз
    link.crossOrigin = '';
    link.href = `/${file}`;
    document.head.appendChild(link);
  }
}

if (path !== '/login') {
  get('/auth/me');
  const group = /^\/g\/([^/]+)(?:\/([a-z]+))?\/?$/.exec(path);
  const student = /^\/s\/([^/]+)(?:\/hero)?$/.exec(path);
  const today = new Date();
  if (group) {
    const [, id, tab] = group;
    get(`/teacher/groups/${id}`);
    if (tab === 'stats') get(`/teacher/groups/${id}/stats?from=${key(new Date(today.getFullYear(), today.getMonth(), 1))}&to=${key(today)}`);
    if (tab === 'attendance') get(`/teacher/groups/${id}/attendance?date=${key(today)}`);
  } else if (student) {
    get(`/teacher/students/${student[1]}/profile`);
  } else if (path === '/' || path === '/hero') {
    const forRole = (r: string | null) => {
      if (r === 'TEACHER' && path === '/') get('/teacher/groups');
      if (r === 'STUDENT') {
        get('/student/profile');
        get('/student/news');
        if (path === '/hero') get('/hero-parts');
      }
    };
    const known = role();
    if (known) forRole(known);
    else {
      // Роль ещё не запомнена (первый вход на этом устройстве): узнаём её из уже идущего /auth/me
      early
        .get('/auth/me')
        ?.response.then((res) => res?.clone().json())
        .then((body: { user?: { role?: string } | null } | undefined) => forRole(body?.user?.role ?? null))
        .catch(() => undefined);
    }
  }
}
