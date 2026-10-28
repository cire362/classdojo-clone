/**
 * Конфиг уровней. Уровень зависит только от суммы ЗАРАБОТАННЫХ баллов (плюсов):
 * списания уровень не понижают. Чтобы поменять пороги — правьте этот массив
 * (первый порог всегда 0, значения строго возрастают).
 */
export const LEVELS: ReadonlyArray<{ threshold: number; title: string }> = [
  { threshold: 0, title: 'Новичок' },
  { threshold: 10, title: 'Стажёр' },
  { threshold: 25, title: 'Защитник' },
  { threshold: 45, title: 'Страж' },
  { threshold: 70, title: 'Герой' },
  { threshold: 100, title: 'Отважный герой' },
  { threshold: 140, title: 'Супергерой' },
  { threshold: 190, title: 'Чемпион' },
  { threshold: 250, title: 'Легенда' },
  { threshold: 320, title: 'Великая легенда' },
];

export const MAX_LEVEL = LEVELS.length;

export interface LevelInfo {
  level: number;
  title: string;
  earned: number;
  /** Порог текущего уровня */
  currentThreshold: number;
  /** Порог следующего уровня, null — достигнут максимум */
  nextThreshold: number | null;
  /** 0..1 — прогресс до следующего уровня */
  progress: number;
  pointsToNext: number;
}

export function levelForPoints(earnedRaw: number): LevelInfo {
  const earned = Math.max(0, Math.floor(earnedRaw || 0));
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (earned >= LEVELS[i].threshold) idx = i;
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const span = next ? next.threshold - current.threshold : 1;
  return {
    level: idx + 1,
    title: current.title,
    earned,
    currentThreshold: current.threshold,
    nextThreshold: next ? next.threshold : null,
    progress: next ? (earned - current.threshold) / span : 1,
    pointsToNext: next ? next.threshold - earned : 0,
  };
}
