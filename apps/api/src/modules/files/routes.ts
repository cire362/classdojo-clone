import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { groupReader, studentReader } from '../access/index.js';
import { fileBytes, findFile } from './service.js';

/** Картинки показываются на странице, всё остальное только скачивается */
const inline = (mime: string) => mime.startsWith('image/');

/** Выдача файлов любой роли; нет прав — 404, как и для чужих групп. Вход проверяет app.ts. ?size=preview — уменьшенная копия */
export const fileRoutes = new Hono<AppEnv>().get('/:id', async (c) => {
  const file = await findFile(c.req.param('id'));
  const user = c.get('user');
  if (file.groupId) await groupReader(user, file.groupId);
  else await studentReader(user, file.studentId!);
  // Файл не меняется, но права могут: no-cache проверяет их при каждом показе, а 304 экономит трафик
  const preview = c.req.query('size') === 'preview';
  const headers = {
    'Cache-Control': 'private, no-cache',
    ETag: `"${file.id}${preview ? '-preview' : ''}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  };
  if (c.req.header('if-none-match') === headers.ETag) return new Response(null, { status: 304, headers });
  const bytes = await fileBytes(file.id, preview);
  return new Response(bytes.stream, {
    headers: {
      ...headers,
      'Content-Type': file.mime,
      'Content-Length': String(bytes.size),
      'Content-Disposition': `${inline(file.mime) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  });
});
