import { normalizeHero } from '@heroes/shared';
import { GARDEN_LEVELS, walkGarden, type Direction } from '@heroes/shared/world';
import type { WorldState } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { HttpError } from '../../platform/errors.js';
import { lockStudent } from '../access/index.js';
import { studentLevel } from '../points/index.js';

/**
 * «Сад маяков» открыт в любой момент: без окна по времени, дневного лимита и запуска сессии.
 * Закрывают его только выключенные герои (мир построен вокруг героя) и архив группы.
 * Учебные баллы, уровни и награды игра не меняет.
 */
async function state(db: Prisma.TransactionClient, studentId: string) {
  const student = await db.student.findUniqueOrThrow({
    where: { id: studentId },
    include: { group: { select: { heroes: true, archivedAt: true } }, worldProgress: true, hero: true },
  });
  if (!student.group.heroes) throw new HttpError(403, 'В вашей группе мир героя выключен');
  const reason = student.group.archivedAt ? 'Группа в архиве. Сад закрыт.' : null;
  return { student, reason, completed: student.worldProgress?.completed ?? [] };
}

export async function getWorld(studentId: string): Promise<WorldState> {
  const s = await state(prisma, studentId);
  const level = await studentLevel(studentId);
  return {
    completed: s.completed,
    available: !s.reason,
    reason: s.reason,
    hero: { parts: normalizeHero(s.student.hero?.parts), level: level.level },
  };
}

/** Решение проверяет сервер: места идут по порядку, маршрут должен зажечь все фонари и дойти до маяка */
export async function solveWorld(studentId: string, levelId: string, moves: Direction[]): Promise<WorldState> {
  await prisma.$transaction(async (tx) => {
    // Блокировка ученика: две вкладки не потеряют восстановленное место друг друга
    await lockStudent(tx, studentId);
    const s = await state(tx, studentId);
    if (s.reason) throw new HttpError(403, s.reason);
    const index = GARDEN_LEVELS.findIndex((l) => l.id === levelId);
    if (index < 0) throw new HttpError(404, 'Место не найдено');
    if (GARDEN_LEVELS.slice(0, index).some((l) => !s.completed.includes(l.id))) {
      throw new HttpError(409, 'Сначала восстанови предыдущие места');
    }
    if (!walkGarden(GARDEN_LEVELS[index], moves).won) throw new HttpError(422, 'Маршрут должен зажечь все фонари и дойти до маяка');
    if (!s.completed.includes(levelId)) {
      const completed = [...s.completed, levelId];
      await tx.worldProgress.upsert({ where: { studentId }, create: { studentId, completed }, update: { completed } });
    }
  });
  return getWorld(studentId);
}
