import { REACTION_KINDS } from '@heroes/shared';
import { z } from 'zod';
import { MAX_POST_LENGTH } from './service.js';

export const PostBody = z.object({
  text: z.string().trim().min(1, 'Напишите текст').max(MAX_POST_LENGTH),
  publishAt: z.string().datetime().optional(),
});
export const PinBody = z.object({ pinned: z.boolean() });
export const ReactionBody = z.object({ kind: z.enum(REACTION_KINDS).nullable() });
export const CommentBody = z.object({ text: z.string().trim().min(1, 'Напишите комментарий').max(500) });
