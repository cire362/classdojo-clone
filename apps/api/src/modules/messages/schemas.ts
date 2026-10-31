import { z } from 'zod';
import { MAX_MESSAGE_LENGTH } from './service.js';

export const MessageBody = z.object({ text: z.string().trim().min(1, 'Напишите сообщение').max(MAX_MESSAGE_LENGTH) });
