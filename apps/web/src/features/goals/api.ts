import { api, type ClassGoal } from '../../lib/api';

type GoalForm = { title: string; target: number };

const goalPath = (groupId: string) => `/teacher/groups/${groupId}/goal`;

export const deleteGoal = (groupId: string) => api('DELETE', goalPath(groupId));

export const saveGoal = (groupId: string, form: GoalForm) => api<ClassGoal>('PUT', goalPath(groupId), form);

export const restartGoal = (groupId: string, form: GoalForm) => api<ClassGoal>('POST', `${goalPath(groupId)}/restart`, form);
