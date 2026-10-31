import { ApiError } from './api';

/** Только бинарный ответ PDF; JSON-ошибка не должна скачиваться как документ. */
export async function fetchReport(studentId: string, from: string, to: string): Promise<Blob> {
  let response: Response;
  try { response = await fetch(`/api/teacher/students/${encodeURIComponent(studentId)}/report.pdf?${new URLSearchParams({ from, to })}`, { credentials: 'same-origin', headers: { 'X-Heroes-Client': '1' } }); }
  catch { throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет'); }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('heroes:unauthorized'));
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error ?? `Ошибка ${response.status}`);
  }
  const blob = await response.blob();
  if (!response.headers.get('content-type')?.includes('application/pdf') || !blob.size) throw new ApiError(500, 'Не удалось получить PDF. Повторите попытку');
  return blob;
}

/** Адрес живёт минуту: мобильные браузеры начинают скачивание не сразу после клика */
export function saveReport(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try { link.href = url; link.download = name.replace(/[\u0000-\u001f/\\]/g, '_'); document.body.append(link); link.click(); }
  finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
