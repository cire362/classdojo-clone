import { z } from 'zod';
import { isDateKey } from '../../platform/dates.js';

export const MonthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'Месяц в формате ГГГГ-ММ') });

export const EventBody = z.object({
  title: z.string().trim().min(1, 'Напишите название').max(120),
  description: z.string().trim().max(500).default(''),
  date: z.string().refine(isDateKey, 'Дата в формате ГГГГ-ММ-ДД'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ').nullable().default(null),
  remindDays: z.number().int().min(0).max(14).nullable().default(null),
});
