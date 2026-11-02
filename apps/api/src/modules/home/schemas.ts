import { z } from 'zod';

export const HomeGoalBody = z.object({
  title: z.string().trim().min(1, 'Напишите цель').max(120),
  target: z.number().int().min(1).max(500),
});

/** С целью причина необязательна: в истории будет её название */
export const HomePointBody = z
  .object({
    goalId: z.string().min(1).nullable().default(null),
    reason: z.string().trim().max(120).default(''),
    points: z.number().int().min(1).max(10),
  })
  .refine((b) => b.goalId || b.reason, 'Напишите, за что баллы');
