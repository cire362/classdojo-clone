import { z } from 'zod';

export const GroupCreate = z.object({ name: z.string().trim().min(1, 'Введите название').max(60) });
export const GroupPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  subtractTeacher: z.boolean().optional(),
  feedComments: z.boolean().optional(),
});
export const TeacherLogin = z.object({ login: z.string().trim().toLowerCase().min(1).max(64) });
