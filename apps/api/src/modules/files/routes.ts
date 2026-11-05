import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { streamBytes } from '../../platform/storage.js';
import { groupReader, studentReader } from '../access/index.js';
import { fileBytes, findFile } from './service.js';

/** Картинки и видео показываются на странице, всё остальное только скачивается */
const inline = (mime: string) => mime.startsWith('image/') || mime.startsWith('video/');

/**
 * Часть файла из заголовка Range: без неё Safari не воспроизводит видео, а перемотка качала бы ролик заново.
 * Поддерживается один диапазон: bytes=начало-конец, bytes=начало- и bytes=-хвост.
 */
function byteRange(header: string | undefined, size: number): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start > end || start >= size) throw new HttpError(416, 'Неверный диапазон', { 'Content-Range': `bytes */${size}` });
  return { start, end };
}

/** Выдача файлов любой роли; нет прав — 404, как и для чужих групп. Вход проверяет app.ts. ?size=preview — уменьшенная копия */
export const fileRoutes = new Hono<AppEnv>().get('/:id', async (c) => {
  const file = await findFile(c.req.param('id'));
  const user = c.get('user');
  if (file.groupId) await groupReader(user, file.groupId);
  else await studentReader(user, file.studentId!);
  if (file.visibleFrom && file.visibleFrom > new Date() && !user.teacherId) throw notFound('Файл не найден');
  // Файл не меняется, но права могут: no-cache проверяет их при каждом показе, а 304 экономит трафик
  const preview = c.req.query('size') === 'preview';
  const headers = {
    'Cache-Control': 'private, no-cache',
    ETag: `"${file.id}${preview ? '-preview' : ''}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  };
  if (c.req.header('if-none-match') === headers.ETag) return new Response(null, { status: 304, headers });
  const { key, size } = await fileBytes(file, preview);
  const range = byteRange(c.req.header('range'), size);
  const body = {
    ...headers,
    'Content-Type': preview && file.mime.startsWith('video/') ? 'image/jpeg' : file.mime,
    'Content-Disposition': `${inline(file.mime) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  };
  if (!range) return new Response(streamBytes(key), { headers: { ...body, 'Content-Length': String(size) } });
  return new Response(streamBytes(key, range), {
    status: 206,
    headers: {
      ...body,
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    },
  });
});
