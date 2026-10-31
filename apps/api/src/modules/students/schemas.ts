import { z } from 'zod';

const id = z.string().min(1).max(64);

export const StudentsCreate = z.object({ names: z.array(z.string().trim().max(80)).min(1).max(100) });
export const StudentPatch = z.object({ name: z.string().trim().min(1).max(80) });
export const ResetMany = z.object({ studentIds: z.array(id).max(200).optional() });
export const MoveBody = z.object({ groupId: id });
