export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Ранние запросы: при старте приложения данные открытой страницы запрашиваются сразу,
 * параллельно с загрузкой кода (см. preloadRoute). Первый же api() с тем же GET-путём
 * забирает готовый ответ. Ответ используется один раз и только пока он свежий.
 */
const EARLY_TTL_MS = 15_000;
type EarlyMap = Map<string, { at: number; response: Promise<Response | null> }>;
// Общая карта с src/app/early.ts, который запускается раньше всего приложения
const early: EarlyMap = ((window as Window & { __heroesEarly?: EarlyMap }).__heroesEarly ??= new Map());

export function prefetchGet(path: string): void {
  if (early.has(path)) return;
  early.set(path, {
    at: Date.now(),
    response: fetch(`/api${path}`, { credentials: 'same-origin' }).catch(() => null),
  });
}

function takeEarly(path: string): Promise<Response | null> | null {
  const hit = early.get(path);
  if (!hit) return null;
  early.delete(path);
  return Date.now() - hit.at < EARLY_TTL_MS ? hit.response : null;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Heroes-Client': '1' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response | null = method === 'GET' ? await (takeEarly(path) ?? Promise.resolve(null)) : null;
  if (!res) {
    try {
      res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет');
    }
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('heroes:unauthorized'));
    throw new ApiError(res.status, data?.error ?? `Ошибка ${res.status}`);
  }
  return data as T;
}

export type * from '@heroes/shared/api';
