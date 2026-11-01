import type { ClassEvent } from '@heroes/shared/api';
import { addDays, dbDate, dbDateKey, localDayStart } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { dropScheduledPost, schedulePost } from '../feed/index.js';

export type EventData = Pick<ClassEvent, 'title' | 'description' | 'date' | 'time' | 'remindDays'>;

/** Напоминание приходит утром, чтобы его увидели до школы */
const REMINDER_HOUR = 8;

type EventRow = Omit<ClassEvent, 'date'> & { date: Date };

const view = (e: EventRow): ClassEvent => ({
  id: e.id,
  title: e.title,
  description: e.description,
  date: dbDateKey(e.date),
  time: e.time,
  remindDays: e.remindDays,
});

/** Месяц «ГГГГ-ММ»: неправильный не должен тихо показать пустой календарь */
function monthRange(month: string) {
  const [year, number] = month.split('-').map(Number);
  if (number < 1 || number > 12) throw new HttpError(400, 'Месяц в формате ГГГГ-ММ');
  return { gte: dbDate(`${month}-01`), lt: new Date(Date.UTC(year, number, 1)) };
}

export async function monthEvents(groupId: string, month: string): Promise<ClassEvent[]> {
  const events = await prisma.classEvent.findMany({
    where: { groupId, date: monthRange(month) },
    orderBy: [{ date: 'asc' }, { time: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
  });
  return events.map(view);
}

export async function studentEvents(studentId: string, month: string): Promise<ClassEvent[]> {
  const { groupId } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } });
  return monthEvents(groupId, month);
}

function reminderText(data: EventData) {
  const [year, month, day] = data.date.split('-').map(Number);
  const date = new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
  return `Напоминание: ${data.title}, ${date}${data.time ? ` в ${data.time}` : ''}.`;
}

/** Срок уже прошёл — напоминать незачем: запись вышла бы сразу и задним числом */
async function reminderPost(groupId: string, teacherId: string, data: EventData) {
  if (data.remindDays === null) return null;
  const at = addDays(localDayStart(data.date), -data.remindDays);
  at.setHours(REMINDER_HOUR);
  return at > new Date() ? schedulePost(groupId, teacherId, reminderText(data), at) : null;
}

export async function createEvent(groupId: string, teacherId: string, data: EventData): Promise<ClassEvent> {
  const reminderPostId = await reminderPost(groupId, teacherId, data);
  return view(await prisma.classEvent.create({ data: { ...data, groupId, date: dbDate(data.date), reminderPostId } }));
}

async function groupEvent(groupId: string, eventId: string) {
  const event = await prisma.classEvent.findFirst({ where: { id: eventId, groupId } });
  if (!event) throw notFound('Событие не найдено');
  return event;
}

/** Изменённое событие получает новое напоминание: прежнее содержало бы старую дату */
export async function updateEvent(groupId: string, eventId: string, teacherId: string, data: EventData): Promise<ClassEvent> {
  const event = await groupEvent(groupId, eventId);
  if (event.reminderPostId) await dropScheduledPost(event.reminderPostId);
  const reminderPostId = await reminderPost(groupId, teacherId, data);
  return view(await prisma.classEvent.update({ where: { id: event.id }, data: { ...data, date: dbDate(data.date), reminderPostId } }));
}

export async function deleteEvent(groupId: string, eventId: string) {
  const event = await groupEvent(groupId, eventId);
  if (event.reminderPostId) await dropScheduledPost(event.reminderPostId);
  await prisma.classEvent.delete({ where: { id: event.id } });
}
