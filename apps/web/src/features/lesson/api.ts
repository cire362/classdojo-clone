import { api, type CardSummary, type ClassGoal, type LessonPlan } from '../../lib/api';

interface AwardResult {
  value: number;
  eventIds: string[];
  classGoal?: ClassGoal | null;
  summaries: Record<string, CardSummary>;
}

export const awardPoints = (groupId: string, studentIds: string[], reasonId: string, subjectId: string | null = null) =>
  api<AwardResult>('POST', `/teacher/groups/${groupId}/points`, { studentIds, reasonId, ...(subjectId ? { subjectId } : {}) });

export const undoPoints = (eventIds: string[]) =>
  api<{ summaries: Record<string, CardSummary> }>('POST', '/teacher/points/undo', { eventIds });

export const fetchGoal = (groupId: string) => api<ClassGoal | null>('GET', `/teacher/groups/${groupId}/goal`);

export const savePlan = (groupId: string, steps: string[]) => api<LessonPlan>('PUT', `/teacher/groups/${groupId}/plan`, { steps });

export const setPlanStep = (groupId: string, current: number) =>
  api<LessonPlan>('PUT', `/teacher/groups/${groupId}/plan/current`, { current });
