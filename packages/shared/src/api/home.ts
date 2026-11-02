/** Домашние баллы: отдельный счёт семьи, к школьным баллам, уровню и магазину не относятся */
export interface HomeGoal {
  id: string;
  title: string;
  target: number;
  /** Может превысить цель, если родители начислили больше нужного */
  progress: number;
}

export interface HomePoint {
  id: string;
  goalId: string | null;
  reason: string;
  points: number;
  createdAt: string;
}

export interface HomeBoard {
  total: number;
  /** Сначала незавершённые */
  goals: HomeGoal[];
  history: HomePoint[];
}
