import { afterEach, expect, it, vi } from 'vitest';
import { fetchReport } from '../src/features/profile/student-report-download';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('получает PDF с cookie и выбранными датами', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('%PDF-', { headers: { 'content-type': 'application/pdf' } }));
  vi.stubGlobal('fetch', fetch);
  expect((await fetchReport('s1', '2026-01-01', '2026-01-31')).size).toBe(5);
  expect(fetch).toHaveBeenCalledWith('/api/teacher/students/s1/report.pdf?from=2026-01-01&to=2026-01-31', expect.objectContaining({ credentials: 'same-origin' }));
});

it('сеть и серверная ошибка показываются сообщением, HTML не скачивается как PDF', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('{"error":"Период слишком длинный"}', { status: 400, headers: { 'content-type': 'application/json' } })).mockResolvedValueOnce(new Response('<html/>', { headers: { 'content-type': 'text/html' } })));
  await expect(fetchReport('s1', 'a', 'b')).rejects.toThrow('Нет связи');
  await expect(fetchReport('s1', 'a', 'b')).rejects.toThrow('Период слишком длинный');
  await expect(fetchReport('s1', 'a', 'b')).rejects.toThrow('Не удалось получить PDF');
});

it('истёкшая сессия вызывает общий выход из приложения', async () => {
  const listener = vi.fn(); window.addEventListener('heroes:unauthorized', listener);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
  try { await expect(fetchReport('s1', 'a', 'b')).rejects.toThrow(); expect(listener).toHaveBeenCalledOnce(); }
  finally { window.removeEventListener('heroes:unauthorized', listener); }
});
