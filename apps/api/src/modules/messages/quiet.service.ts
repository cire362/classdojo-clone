import type { ParentNotice, QuietHours } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';

const DAY = 24 * 60;

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Время школы: часовой пояс процесса, как и у остальных дат */
const minuteOfDay = (now: Date) => now.getHours() * 60 + now.getMinutes();

/** Промежуток может переходить через полночь: с 22:00 до 07:00 */
export function inQuietHours(from: number, to: number, minute: number) {
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

export async function quietHours(teacherId: string): Promise<QuietHours | null> {
  const t = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId }, select: { quietFrom: true, quietTo: true } });
  return t.quietFrom === null || t.quietTo === null ? null : { from: toTime(t.quietFrom), to: toTime(t.quietTo) };
}

export async function saveQuietHours(teacherId: string, hours: QuietHours | null) {
  const data = hours ? { quietFrom: toMinutes(hours.from), quietTo: toMinutes(hours.to) } : { quietFrom: null, quietTo: null };
  await prisma.teacher.update({ where: { id: teacherId }, data });
  return hours;
}

/** Значок новых сообщений в тихие часы не показывается: сами сообщения никуда не деваются */
export async function isQuietNow(teacherId: string, now = new Date()) {
  const t = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId }, select: { quietFrom: true, quietTo: true } });
  return t.quietFrom !== null && t.quietTo !== null && inQuietHours(t.quietFrom, t.quietTo, minuteOfDay(now));
}

/** Родитель видит подсказку, только когда отдыхают все преподаватели группы, и время ближайшего ответа */
export async function parentNotice(studentId: string, now = new Date()): Promise<ParentNotice> {
  const { group } = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      group: {
        select: {
          teacher: { select: { quietFrom: true, quietTo: true } },
          coTeachers: { select: { teacher: { select: { quietFrom: true, quietTo: true } } } },
        },
      },
    },
  });
  const minute = minuteOfDay(now);
  const teachers = [group.teacher, ...group.coTeachers.map((c) => c.teacher)];
  const ends: number[] = [];
  for (const { quietFrom, quietTo } of teachers) {
    if (quietFrom === null || quietTo === null || !inQuietHours(quietFrom, quietTo, minute)) return { quietUntil: null };
    ends.push(quietTo);
  }
  const nearest = ends.reduce((best, end) => ((end - minute + DAY) % DAY < (best - minute + DAY) % DAY ? end : best));
  return { quietUntil: toTime(nearest) };
}
