import { z } from 'zod';
import { MAX_MESSAGE_LENGTH } from './service.js';

/** Пустой текст допустим, если приложены файлы: это проверяет сервис */
const text = z.string().trim().max(MAX_MESSAGE_LENGTH);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ');

export const MessageBody = z.object({ text, sendAt: z.string().datetime().optional() });
export const QuietBody = z.object({
  hours: z.object({ from: time, to: time }).refine((h) => h.from !== h.to, 'Начало и конец тихих часов должны отличаться').nullable(),
});
