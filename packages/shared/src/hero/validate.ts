import { HERO_PARTS_BY_ID, HERO_SLOTS, type HeroParts, type HeroSlot } from './catalog.js';

export type HeroValidationResult =
  | { ok: true; parts: HeroParts }
  | { ok: false; error: string };

/**
 * Строгая проверка выбора деталей: все слоты заполнены, детали существуют,
 * относятся к нужному слою и открыты на уровне ученика.
 * `isUnlocked` позволяет бэкенду учитывать данные из БД (например, платные детали).
 */
export function validateHeroSelection(
  input: unknown,
  level: number,
  isUnlocked: (partId: string, level: number) => boolean = (id, lvl) =>
    (HERO_PARTS_BY_ID.get(id)?.requiredLevel ?? Infinity) <= lvl,
): HeroValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Некорректный формат героя' };
  }
  const src = input as Record<string, unknown>;
  const extra = Object.keys(src).filter((k) => !(k in HERO_SLOTS));
  if (extra.length) return { ok: false, error: `Неизвестные слоты: ${extra.join(', ')}` };

  const parts = {} as HeroParts;
  for (const [slot, layer] of Object.entries(HERO_SLOTS) as [HeroSlot, string][]) {
    const id = src[slot];
    if (typeof id !== 'string') return { ok: false, error: `Не выбрана деталь: ${slot}` };
    const part = HERO_PARTS_BY_ID.get(id);
    if (!part || part.layer !== layer) return { ok: false, error: `Неизвестная деталь: ${id}` };
    if (!isUnlocked(id, level)) {
      return { ok: false, error: `Деталь «${part.name}» откроется на ${part.requiredLevel} уровне` };
    }
    parts[slot] = id;
  }
  return { ok: true, parts };
}
