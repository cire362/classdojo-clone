import { ApiError } from './api';

/**
 * Надёжная отправка при плохом интернете (школьный Wi-Fi, мобильная сеть):
 * загрузка с прогрессом, повторы с паузой и ожидание восстановления связи.
 */

export class CancelledError extends Error {
  constructor() {
    super('Отменено');
  }
}

/** Повторять имеет смысл при обрыве связи, таймауте и временной недоступности сервера */
export function isRetryable(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 0 || e.status === 408 || e.status === 502 || e.status === 503 || e.status === 504);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CancelledError());
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new CancelledError());
    });
  });
}

/** Ждём события online (не дольше maxMs) */
export function waitOnline(signal?: AbortSignal, maxMs = 60_000): Promise<void> {
  if (navigator.onLine) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const cancel = () => {
      cleanup();
      reject(new CancelledError());
    };
    const t = setTimeout(done, maxMs);
    const cleanup = () => {
      clearTimeout(t);
      window.removeEventListener('online', done);
      signal?.removeEventListener('abort', cancel);
    };
    window.addEventListener('online', done);
    signal?.addEventListener('abort', cancel);
  });
}

export interface RetryStatus {
  attempt: number;
  attempts: number;
  /** offline — ждём сеть, retrying — пауза перед повтором */
  state: 'sending' | 'offline' | 'retrying';
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { attempts?: number; signal?: AbortSignal; onStatus?: (s: RetryStatus) => void } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  for (let attempt = 1; ; attempt++) {
    if (!navigator.onLine) {
      opts.onStatus?.({ attempt, attempts, state: 'offline' });
      await waitOnline(opts.signal);
    }
    opts.onStatus?.({ attempt, attempts, state: 'sending' });
    try {
      return await fn(attempt);
    } catch (e) {
      if (e instanceof CancelledError || opts.signal?.aborted) throw new CancelledError();
      if (attempt >= attempts || !isRetryable(e)) throw e;
      opts.onStatus?.({ attempt: attempt + 1, attempts, state: 'retrying' });
      await sleep(1000 * 2 ** (attempt - 1), opts.signal);
    }
  }
}

/**
 * Загрузка формы через XMLHttpRequest: в отличие от fetch, показывает прогресс отправки.
 * Ошибки приводятся к ApiError, как у обычного api().
 */
export function uploadForm<T>(
  path: string,
  form: FormData,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    xhr.setRequestHeader('X-Heroes-Client', '1');
    xhr.timeout = opts.timeoutMs ?? 60_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data: { error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* не JSON — например, страница ошибки прокси */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else {
        if (xhr.status === 401) window.dispatchEvent(new Event('heroes:unauthorized'));
        reject(new ApiError(xhr.status, data?.error ?? `Ошибка ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Нет связи с сервером'));
    xhr.ontimeout = () => reject(new ApiError(408, 'Сервер долго не отвечает'));
    xhr.onabort = () => reject(new CancelledError());
    opts.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
