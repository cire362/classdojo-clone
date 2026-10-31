import { z } from 'zod';
import { TEAM_COLORS } from './service.js';

export const TeamBody = z.object({ name: z.string().trim().min(1, 'Введите название').max(30) });
export const TeamPatch = z.object({ name: z.string().trim().min(1).max(30).optional(), color: z.enum(TEAM_COLORS).optional() });
export const TeamAssign = z.object({ assignments: z.record(z.string().max(64), z.string().max(64).nullable()) });
