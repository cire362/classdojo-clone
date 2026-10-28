import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 502 | 503,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Не найдено') => new HttpError(404, what);

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    throw new HttpError(400, `Некорректные данные${path ? ` (${path})` : ''}: ${issue?.message ?? ''}`);
  }
  return r.data;
}
