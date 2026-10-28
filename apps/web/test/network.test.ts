import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/api';
import { CancelledError, isRetryable, withRetry, type RetryStatus } from '../src/lib/network';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
});

describe('isRetryable', () => {
  it('повторяем обрыв связи, таймаут и временные ошибки сервера', () => {
    for (const status of [0, 408, 502, 503, 504]) expect(isRetryable(new ApiError(status, 'x')), String(status)).toBe(true);
  });
  it('не повторяем ошибки запроса и прав', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 500]) expect(isRetryable(new ApiError(status, 'x')), String(status)).toBe(false);
    expect(isRetryable(new Error('x'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('после двух обрывов третья попытка успешна, статусы сообщаются', async () => {
    vi.useFakeTimers();
    const statuses: RetryStatus[] = [];
    let calls = 0;
    const promise = withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new ApiError(0, 'Нет связи');
        return 'ok';
      },
      { onStatus: (s) => statuses.push(s) },
    );
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(calls).toBe(3);
    expect(statuses.filter((s) => s.state === 'retrying').map((s) => s.attempt)).toEqual([2, 3]);
  });

  it('после всех попыток отдаёт последнюю ошибку', async () => {
    vi.useFakeTimers();
    const promise = withRetry(async () => {
      throw new ApiError(503, 'Недоступен');
    });
    const check = expect(promise).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await check;
  });

  it('ошибки данных не повторяются', async () => {
    const fn = vi.fn(async () => {
      throw new ApiError(422, 'Плохое фото');
    });
    await expect(withRetry(fn)).rejects.toMatchObject({ status: 422 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('без интернета ждёт события online', async () => {
    setOnline(false);
    const statuses: string[] = [];
    const fn = vi.fn(async () => 'ok');
    const promise = withRetry(fn, { onStatus: (s) => statuses.push(s.state) });
    await Promise.resolve();
    expect(fn).not.toHaveBeenCalled();
    expect(statuses).toEqual(['offline']);
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await expect(promise).resolves.toBe('ok');
    expect(statuses).toEqual(['offline', 'sending']);
  });

  it('отмена прерывает ожидание', async () => {
    setOnline(false);
    const controller = new AbortController();
    const promise = withRetry(async () => 'ok', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(CancelledError);
  });
});
