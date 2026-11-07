/** Приём «Подумай — обсуди — поделись»: длительности и текущий этап хранятся только в текущей вкладке. */
export const PLAN_KEY = 'heroes:think-pair-share:v1:';
export const COUNTDOWN_KEY = 'heroes:think-pair-share-timer:v1:';
export const MAX_STAGE_MINUTES = 30;

export const STAGES = [
  { title: 'Подумай', hint: 'Каждый думает молча и сам' },
  { title: 'Обсуди', hint: 'Обсудите ответ в паре' },
  { title: 'Поделись', hint: 'Расскажите о выводах всем' },
] as const;

export const LAST_STAGE = STAGES.length - 1;

export interface Plan {
  version: 1;
  stage: number;
  minutes: number[];
}

export const defaultPlan = (): Plan => ({ version: 1, stage: 0, minutes: [1, 2, 3] });

const validMinutes = (m: unknown) => Number.isInteger(m) && (m as number) >= 1 && (m as number) <= MAX_STAGE_MINUTES;

/** Длительности из полей формы; null, если хотя бы одна не подходит */
export function stageMinutes(fields: string[]): number[] | null {
  if (fields.some((f) => !/^\d{1,2}$/.test(f))) return null;
  const minutes = fields.map(Number);
  return minutes.every(validMinutes) ? minutes : null;
}

export function restorePlan(raw: string | null): Plan {
  try {
    const p = JSON.parse(raw ?? 'null') as Plan | null;
    if (!p || p.version !== 1 || !Number.isInteger(p.stage) || p.stage < 0 || p.stage > LAST_STAGE) return defaultPlan();
    if (!Array.isArray(p.minutes) || p.minutes.length !== STAGES.length || !p.minutes.every(validMinutes)) return defaultPlan();
    return { version: 1, stage: p.stage, minutes: p.minutes };
  } catch {
    return defaultPlan();
  }
}
