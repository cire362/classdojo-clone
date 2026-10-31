import {
  api,
  type ParentRewards,
  type PendingRewardGroups,
  type Reward,
  type RewardRequest,
  type Shop,
} from '../../lib/api';

export const fetchChildRewards = (childId: string, before?: string) =>
  api<ParentRewards>(
    'GET',
    `/parent/children/${childId}/rewards${before ? `?${new URLSearchParams({ before })}` : ''}`,
  );

export const fetchPendingRequests = () => api<PendingRewardGroups>('GET', '/teacher/reward-requests');

export const fetchGroupRewards = (groupId: string) =>
  api<{ rewards: Reward[]; requests: RewardRequest[] }>('GET', `/teacher/groups/${groupId}/rewards`);

export const decideRequest = (requestId: string, approve: boolean) =>
  api<RewardRequest[]>('POST', `/teacher/reward-requests/${requestId}/${approve ? 'approve' : 'reject'}`);

export const addReward = (groupId: string, form: Omit<Reward, 'id'>) => api<Reward[]>('POST', `/teacher/groups/${groupId}/rewards`, form);

export const removeReward = (rewardId: string) => api<Reward[]>('DELETE', `/teacher/rewards/${rewardId}`);

export const fetchShop = () => api<Shop>('GET', '/student/shop');

export const requestReward = (rewardId: string) => api<Shop>('POST', `/student/shop/${rewardId}/request`);

export const cancelRequest = (requestId: string) => api<Shop>('DELETE', `/student/shop/requests/${requestId}`);
