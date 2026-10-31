import { api, type CardSummary, type ClassGoal } from '../../lib/api';

interface AwardResult {
  value: number;
  eventIds: string[];
  classGoal?: ClassGoal | null;
  summaries: Record<string, CardSummary>;
}

export const awardPoints = (groupId: string, studentIds: string[], reasonId: string) =>
  api<AwardResult>('POST', `/teacher/groups/${groupId}/points`, { studentIds, reasonId });

export const undoPoints = (eventIds: string[]) =>
  api<{ summaries: Record<string, CardSummary> }>('POST', '/teacher/points/undo', { eventIds });

export const fetchGoal = (groupId: string) => api<ClassGoal | null>('GET', `/teacher/groups/${groupId}/goal`);
