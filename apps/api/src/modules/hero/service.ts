import { HERO_PARTS, normalizeHero, validateHeroSelection, type HeroValidationResult } from '@heroes/shared';
import type { Hero } from '@heroes/shared/api';
import { z } from 'zod';
import { prisma } from '../../platform/db.js';
import { HttpError, parse } from '../../platform/errors.js';
import { studentLevel } from '../points/index.js';

const HeroBody = z.object({
  name: z.string().trim().max(40),
  parts: z.record(z.string(), z.string()),
});

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
 * выключенные детали недоступны.
 */
async function validateHeroForLevel(parts: unknown, level: number): Promise<HeroValidationResult> {
  const rows = await prisma.heroPart.findMany({ where: { active: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return validateHeroSelection(parts, level, (id, lvl) => {
    const row = byId.get(id);
    if (!row) return false;
    return row.requiredLevel <= lvl;
  });
}

/** Общая логика сохранения героя: проверяем детали по уровню ученика */
export async function saveHero(studentId: string, body: unknown): Promise<Hero> {
  const { name, parts } = parse(HeroBody, body);
  const level = await studentLevel(studentId);
  // Вкладка старой версии может ещё не знать о питомце: сохраняем выбор из БД.
  if (parts.pet === undefined) {
    const saved = await prisma.hero.findUnique({ where: { studentId }, select: { parts: true } });
    parts.pet = normalizeHero(saved?.parts).pet;
  }
  const check = await validateHeroForLevel(parts, level.level);
  if (!check.ok) throw new HttpError(422, check.error);
  const hero = await prisma.hero.upsert({
    where: { studentId },
    create: { studentId, name, parts: check.parts },
    update: { name, parts: check.parts },
  });
  return { name: hero.name, parts: check.parts };
}

/** Каталог деталей с требованиями: открытость проверяет клиент, сохранение — сервер */
export async function activeHeroParts() {
  const parts = await prisma.heroPart.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  return parts.map((p) => ({ id: p.id, requiredLevel: p.requiredLevel }));
}
