import { HttpError } from './errors.js';

/**
 * Работа с календарными датами в часовом поясе процесса (переменная TZ,
 * в docker-compose — Europe/Moscow). «Сегодня» и «неделя» считаются по нему.
 */

export function startOfDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Неделя начинается с понедельника */
export function startOfWeek(d = new Date()): Date {
  const s = startOfDay(d);
  const shift = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - shift);
  return s;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** 'YYYY-MM-DD' для локальной даты */
export function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

/** Значение для колонки @db.Date (полночь UTC указанного дня) */
export function dbDate(key: string): Date {
  return new Date(key + 'T00:00:00Z');
}

/** Обратное преобразование @db.Date → 'YYYY-MM-DD' */
export function dbDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Локальная полночь дня, заданного ключом 'YYYY-MM-DD' */
export function localDayStart(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Момент отложенной отправки: только в будущем и в пределах срока */
export function scheduledAt(value: string, maxDays = 60): Date {
  const at = new Date(value);
  if (+at <= Date.now()) throw new HttpError(400, 'Выберите время в будущем');
  if (+at > Date.now() + maxDays * 24 * 3600 * 1000) throw new HttpError(400, `Отложить можно не больше чем на ${maxDays} дней`);
  return at;
}
