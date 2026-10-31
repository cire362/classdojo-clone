import { api, type Stats, type WeeklyStats } from '../../lib/api';

export const fetchStats = (groupId: string, from: string, to: string) =>
  api<Stats>('GET', `/teacher/groups/${groupId}/stats?from=${from}&to=${to}`);

export const fetchWeeklyStats = (groupId: string, query: string) =>
  api<WeeklyStats>('GET', `/teacher/groups/${groupId}/stats/weekly?${query}`);
