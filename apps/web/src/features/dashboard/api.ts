import { api, type Dashboard, type DashboardBy } from '../../lib/api';

export const fetchDashboard = (by: DashboardBy, from: string, to: string) =>
  api<Dashboard>('GET', `/admin/dashboard?${new URLSearchParams({ by, from, to })}`);
