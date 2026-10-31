import type { Detection } from '@heroes/shared/api';
import { env } from '../../platform/env.js';
import { HttpError } from '../../platform/errors.js';

/**
 * Отправляет фото в сервис подсчёта людей. Файл живёт только в памяти этого
 * запроса: ни бэкенд, ни сервис подсчёта не пишут его на диск и в БД.
 */
export async function countPeople(photo: Blob): Promise<Detection> {
  let res: Response;
  try {
    res = await fetch(`${env.detectorUrl}/count`, {
      method: 'POST',
      body: photo,
      headers: { 'Content-Type': photo.type || 'image/jpeg' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(503, 'Сервис подсчёта недоступен. Можно отметить учеников вручную');
  }
  if (res.status === 400 || res.status === 415 || res.status === 413) {
    throw new HttpError(422, 'Не удалось прочитать изображение. Попробуйте другое фото');
  }
  if (!res.ok) throw new HttpError(502, 'Сервис подсчёта вернул ошибку');
  return (await res.json()) as Detection;
}
