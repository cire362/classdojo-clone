import { REPORT_REASONS, type ReportReason } from '@heroes/shared';
import { z } from 'zod';

export const ReportBody = z.object({
  reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]], { message: 'Выберите причину' }),
  note: z.string().trim().max(300).default(''),
  commentId: z.string().min(1).optional(),
});
export const HiddenBody = z.object({ hidden: z.boolean() });
export const TargetParam = z.enum(['post', 'comment']);
