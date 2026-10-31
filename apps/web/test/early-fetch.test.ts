import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  // Карта ранних ответов живёт в window (общая с src/early.ts)
  delete (window as Window & { __heroesEarly?: unknown }).__heroesEarly;
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function freshApi() {
  vi.resetModules();
  return import('../src/lib/api');
}

describe('ранние запросы данных страницы', () => {
  it('ответ раннего запроса забирается первым api() и только один раз', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ n: fetchMock.mock.calls.length }));
    const { api, prefetchGet } = await freshApi();
    prefetchGet('/teacher/groups/g1');
    prefetchGet('/teacher/groups/g1'); // повтор не создаёт второй запрос
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(api('GET', '/teacher/groups/g1')).resolves.toEqual({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Второй вызов уже идёт в сеть за свежими данными
    await expect(api('GET', '/teacher/groups/g1')).resolves.toEqual({ n: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('устаревший ранний ответ не используется', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ n: fetchMock.mock.calls.length }));
    const { api, prefetchGet } = await freshApi();
    prefetchGet('/student/profile');
    vi.advanceTimersByTime(20_000);
    await expect(api('GET', '/student/profile')).resolves.toEqual({ n: 2 });
  });

  it('ранний запрос не используется для изменяющих запросов', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ ok: true }));
    const { api, prefetchGet } = await freshApi();
    prefetchGet('/teacher/groups');
    await api('POST', '/teacher/groups', { name: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
  });

  it('если ранний запрос не удался, api() делает обычный', async () => {
    let n = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      n++;
      if (n === 1) throw new TypeError('offline');
      return json({ ok: true });
    });
    const { api, prefetchGet } = await freshApi();
    prefetchGet('/auth/me');
    await expect(api('GET', '/auth/me')).resolves.toEqual({ ok: true });
    expect(n).toBe(2);
  });

  it('ошибка из раннего ответа обрабатывается как обычно (401 → выход)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ error: 'Нужно войти' }, 401));
    const { api, prefetchGet, ApiError } = await freshApi();
    const onUnauthorized = vi.fn();
    window.addEventListener('heroes:unauthorized', onUnauthorized);
    prefetchGet('/teacher/groups');
    // Сам ранний запрос никого не разлогинивает
    await Promise.resolve();
    expect(onUnauthorized).not.toHaveBeenCalled();
    await expect(api('GET', '/teacher/groups')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    window.removeEventListener('heroes:unauthorized', onUnauthorized);
  });
});
