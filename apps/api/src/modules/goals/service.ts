import type { ClassGoal } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { lockGroup } from '../access/index.js';

/** Баллы принадлежат цели, а не текущему составу класса: перевод ученика не переносит его вклад. */
export async function classGoal(groupId: string): Promise<ClassGoal | null> {
  const goal = await prisma.classGoal.findUnique({ where: { groupId } });
  if (!goal) return null;
  const points = await prisma.pointEvent.aggregate({ where: { classGoalId: goal.id, value: { gt: 0 } }, _sum: { value: true } });
  const earned = points._sum.value ?? 0;
  return {
    id: goal.id,
    title: goal.title,
    target: goal.target,
    earned,
    reached: earned >= goal.target,
    createdAt: goal.createdAt.toISOString(),
  };
}

/** Редактирование сохраняет вклад, запуск новой цели (restart) обнуляет его без изменения истории баллов. */
export async function saveClassGoal(groupId: string, data: { title: string; target: number }, restart = false) {
  await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    if (restart) await tx.classGoal.deleteMany({ where: { groupId } });
    await tx.classGoal.upsert({ where: { groupId }, create: { groupId, ...data }, update: data });
  });
  return classGoal(groupId);
}

export async function removeClassGoal(groupId: string) {
  await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    await tx.classGoal.deleteMany({ where: { groupId } });
  });
}
