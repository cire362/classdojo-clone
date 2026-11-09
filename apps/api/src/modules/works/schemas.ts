import { z } from 'zod';

export const WorkBody = z.object({
  title: z.string().trim().min(1, 'Назовите работу').max(100),
  text: z.string().trim().max(2000).default(''),
  subjectId: z.string().max(64).optional(),
});
export const DecisionBody = z.object({
  status: z.enum(['APPROVED', 'RETURNED']),
  comment: z.string().trim().max(500).default(''),
});
