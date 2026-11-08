import { api, type NetworkOverview } from '../../lib/api';

export const fetchNetworkOverview = (from: string, to: string) =>
  api<NetworkOverview>('GET', `/network/overview?${new URLSearchParams({ from, to })}`);
