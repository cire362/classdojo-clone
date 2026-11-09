import type { HeroParts } from '../hero/catalog.js';

/** «Сад маяков» ученика: открыт в любой момент, пока в группе есть герои и она не в архиве */
export interface WorldState {
  completed: string[];
  available: boolean;
  /** Почему сад сейчас закрыт */
  reason: string | null;
  hero: { parts: HeroParts; level: number };
}
