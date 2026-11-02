import { api, type HomeBoard, type HomeGoal, type HomePoint } from '../../lib/api';

export type GoalData = Pick<HomeGoal, 'title' | 'target'>;
export type PointData = Pick<HomePoint, 'goalId' | 'reason' | 'points'>;

/** Адрес свой у родителя и ученика, поэтому его передаёт страница */
export const fetchHome = (path: string) => api<HomeBoard>('GET', path);

export const createGoal = (path: string, data: GoalData) => api('POST', `${path}/goals`, data);

export const updateGoal = (path: string, id: string, data: GoalData) => api('PUT', `${path}/goals/${id}`, data);

export const deleteGoal = (path: string, id: string) => api('DELETE', `${path}/goals/${id}`);

export const addPoints = (path: string, data: PointData) => api('POST', `${path}/points`, data);

export const deletePoint = (path: string, id: string) => api('DELETE', `${path}/points/${id}`);
