import type { ZodType, output } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 416 | 422 | 429 | 502 | 503,
    message: string,
    public headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const notFound = (what = 'Не найдено') => new HttpError(404, what);

export function parse<S extends ZodType>(schema: S, data: unknown): output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    throw new HttpError(400, `Некорректные данные${path ? ` (${path})` : ''}: ${issue?.message ?? ''}`);
  }
  return r.data;
}

/** Нарушение уникальности в БД: например, логин заняли одновременно с проверкой */
export const isUniqueViolation = (err: unknown) => typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
