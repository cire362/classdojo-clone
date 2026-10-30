/** Типы ответов API: магазин наград */

export interface Reward {
  id: string;
  title: string;
  emoji: string;
  cost: number;
}

export interface RewardRequest {
  id: string;
  title: string;
  emoji: string;
  cost: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  decidedAt: string | null;
  student?: { id: string; name: string };
}

export interface Shop {
  balance: number;
  archived: boolean;
  rewards: Reward[];
  requests: RewardRequest[];
}

export interface ParentRewards {
  student: { id: string; name: string; groupName: string };
  balance: number;
  archived: boolean;
  rewards: Reward[];
  pending: RewardRequest[];
  history: RewardRequest[];
  nextCursor: string | null;
}

export interface PendingRewardGroups {
  groups: { id: string; name: string; count: number }[];
  total: number;
}
