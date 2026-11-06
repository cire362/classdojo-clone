import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../../platform/auth.js';
import { env } from '../../platform/env.js';
import { HttpError, parse } from '../../platform/errors.js';
import { MAX_ATTACHMENTS } from './attachments.service.js';
import { MessageBody } from './schemas.js';

/** Все вложения предельного размера и запас на служебные части запроса: точные пределы проверяет сервис */
export const messageLimit = bodyLimit({
  maxSize: MAX_ATTACHMENTS * env.maxFileBytes + 1024 * 1024,
  onError: () => {
    throw new HttpError(413, 'Файлы слишком большие');
  },
});

/** Сообщение без файлов приходит JSON, с файлами — multipart: поля text и sendAt, файлы file */
export async function messageInput(c: Context<AppEnv>): Promise<{ text: string; sendAt?: string; files: File[] }> {
  if (!c.req.header('content-type')?.startsWith('multipart/form-data')) {
    return { ...parse(MessageBody, await c.req.json().catch(() => null)), files: [] };
  }
  const body = await c.req.parseBody({ all: true });
  const files = [body.file ?? []].flat().filter((f): f is File => f instanceof File);
  if (files.length > MAX_ATTACHMENTS) throw new HttpError(400, `К сообщению можно приложить не больше ${MAX_ATTACHMENTS} файлов`);
  const field = (name: string) => (typeof body[name] === 'string' ? (body[name] as string) : undefined);
  return { ...parse(MessageBody, { text: field('text') ?? '', sendAt: field('sendAt') || undefined }), files };
}
