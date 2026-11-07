import { z } from 'zod';
import { isDateKey } from '../../platform/dates.js';

export const MAX_POINTS = 10;

export const AssignmentBody = z
  .object({
    title: z.string().trim().min(1, 'Назовите задание').max(100),
    description: z.string().trim().max(2000).default(''),
    dueOn: z.string().refine(isDateKey, 'Срок — дата в формате ГГГГ-ММ-ДД').optional(),
    points: z.coerce.number().int().min(0).max(MAX_POINTS).default(0),
    target: z.enum(['all', 'team', 'students']).default('all'),
    teamId: z.string().min(1).optional(),
    studentIds: z.array(z.string().min(1)).max(200).default([]),
  })
  .refine((a) => a.target !== 'team' || a.teamId, { message: 'Выберите команду', path: ['teamId'] })
  .refine((a) => a.target !== 'students' || a.studentIds.length, { message: 'Выберите, кому выдать задание', path: ['studentIds'] });

export type AssignmentInput = z.infer<typeof AssignmentBody>;

export const DecisionBody = z.object({
  status: z.enum(['APPROVED', 'RETURNED']),
  comment: z.string().trim().max(500).default(''),
});

export const AnswerBody = z.object({ text: z.string().trim().max(2000).default('') });
