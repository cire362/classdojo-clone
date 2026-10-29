import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../lib/errors.js';
import { ARCHIVED_MESSAGE } from './access.js';

/** Изменение цели и начисление сериализуются по группе: начисление не попадёт в удалённую цель. */
export async function lockGoalGroup(tx: Prisma.TransactionClient, groupId: string) {
  const rows = await tx.$queryRaw<{ archivedAt: Date | null }[]>`SELECT "archivedAt" FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
  if (!rows.length) throw notFound('Группа не найдена');
  if (rows[0].archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
}

/** Баллы принадлежат цели, а не текущему составу класса: перевод ученика не переносит его вклад. */
export async function classGoal(groupId: string) {
  const goal = await prisma.classGoal.findUnique({ where: { groupId } });
  if (!goal) return null;
  const points = await prisma.pointEvent.aggregate({ where: { classGoalId: goal.id, value: { gt: 0 } }, _sum: { value: true } });
  const earned = points._sum.value ?? 0;
  return { id: goal.id, title: goal.title, target: goal.target, earned, reached: earned >= goal.target, createdAt: goal.createdAt };
}

/** Редактирование сохраняет вклад, запуск новой цели (restart) обнуляет его без изменения истории баллов. */
export async function saveClassGoal(groupId: string, data: { title: string; target: number }, restart = false) {
  await prisma.$transaction(async (tx) => {
    await lockGoalGroup(tx, groupId);
    if (restart) await tx.classGoal.deleteMany({ where: { groupId } });
    await tx.classGoal.upsert({ where: { groupId }, create: { groupId, ...data }, update: data });
  });
  return classGoal(groupId);
}

export async function removeClassGoal(groupId: string) {
  await prisma.$transaction(async (tx) => {
    await lockGoalGroup(tx, groupId);
    await tx.classGoal.deleteMany({ where: { groupId } });
  });
}
