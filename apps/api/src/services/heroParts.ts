import { HERO_PARTS, validateHeroSelection, type HeroValidationResult } from '@heroes/shared';
import { prisma } from '../db.js';

/** Синхронизирует таблицу HeroPart с каталогом из packages/shared (вызывается при старте и в seed) */
export async function syncHeroParts(): Promise<void> {
  await prisma.$transaction([
    ...HERO_PARTS.map((p, i) =>
      prisma.heroPart.upsert({
        where: { id: p.id },
        create: { id: p.id, layer: p.layer, name: p.name, requiredLevel: p.requiredLevel, sortOrder: i },
        update: { layer: p.layer, name: p.name, requiredLevel: p.requiredLevel, sortOrder: i, active: true },
      }),
    ),
    prisma.heroPart.updateMany({ where: { id: { notIn: HERO_PARTS.map((p) => p.id) } }, data: { active: false } }),
  ]);
}

/**
 * Проверка выбора деталей с учётом БД: требуемый уровень берётся из HeroPart,
 * платные (isPremium) и выключенные детали недоступны.
 */
export async function validateHeroForLevel(parts: unknown, level: number): Promise<HeroValidationResult> {
  const rows = await prisma.heroPart.findMany({ where: { active: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return validateHeroSelection(parts, level, (id, lvl) => {
    const row = byId.get(id);
    return !!row && !row.isPremium && row.requiredLevel <= lvl;
  });
}
