import { dateKey, formatDate } from '../../lib/hooks';
import type { RetryStatus } from '../../lib/network';

export function uploadText({ progress, status }: { progress: number; status: RetryStatus | null }): string {
  if (!status) return 'Готовим фото…';
  if (status.state === 'offline') return 'Нет интернета. Отправим фото, как только связь появится';
  if (status.state === 'retrying') return `Связь прервалась. Пробуем ещё раз (${status.attempt} из ${status.attempts})…`;
  if (progress < 1) return `Отправляем фото… ${Math.round(progress * 100)}%`;
  return 'Считаем людей на фото…';
}

export const shiftDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

/** «сегодня», «вчера» или «пн, 26 октября» */
export function dayLabel(key: string): string {
  if (key === dateKey()) return 'сегодня';
  if (key === shiftDays(-1)) return 'вчера';
  return formatDate(key).toLowerCase();
}
