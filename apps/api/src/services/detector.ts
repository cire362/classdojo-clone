import { env } from '../env.js';
import { HttpError } from '../lib/errors.js';

export interface DetectionResult {
  count: number;
  width: number;
  height: number;
  boxes: { x: number; y: number; w: number; h: number; score: number }[];
  elapsedMs: number;
}

/**
 * Отправляет фото в сервис подсчёта людей. Файл живёт только в памяти этого
 * запроса: ни бэкенд, ни сервис подсчёта не пишут его на диск и в БД.
 */
export async function countPeople(photo: Blob): Promise<DetectionResult> {
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
  const data = (await res.json()) as DetectionResult;
  return data;
}
