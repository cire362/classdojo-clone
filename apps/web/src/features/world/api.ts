import { api, type WorldState } from '../../lib/api';
import type { Direction } from '@heroes/shared/world';

export const fetchWorld = () => api<WorldState>('GET', '/student/world');
export const solveWorld = (levelId: string, moves: Direction[]) => api<WorldState>('POST', '/student/world/solve', { levelId, moves });
