import { api, type WeeklySummary } from '../../lib/api';

export const fetchWeeklySummary = (childId: string, week?: string) =>
  api<WeeklySummary>('GET', `/parent/children/${childId}/weekly-summary${week ? `?week=${encodeURIComponent(week)}` : ''}`);
