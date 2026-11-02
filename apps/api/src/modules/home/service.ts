import type { HomeBoard, HomeGoal, HomePoint } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { lockStudent } from '../access/index.js';

/**
 * Домашние баллы. Цели и начисления общие для всех родителей ребёнка, ученик их только видит.
 * Счёт отдельный: эти таблицы не читают уровень, магазин, рейтинги и отчёты преподавателя.
 */
const MAX_GOALS = 20;
const HISTORY = 30;

export type GoalData = Pick<HomeGoal, 'title' | 'target'>;
export type PointData = Pick<HomePoint, 'goalId' | 'reason' | 'points'>;

export async function homeBoard(studentId: string): Promise<HomeBoard> {
  const [goals, sums, history] = await Promise.all([
    prisma.homeGoal.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' } }),
    prisma.homePoint.groupBy({ by: ['goalId'], where: { studentId }, _sum: { points: true } }),
    prisma.homePoint.findMany({ where: { studentId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: HISTORY }),
  ]);
  const earned = new Map(sums.map((s) => [s.goalId, s._sum.points ?? 0]));
  const list = goals.map((g) => ({ id: g.id, title: g.title, target: g.target, progress: earned.get(g.id) ?? 0 }));
  const isDone = (g: HomeGoal) => Number(g.progress >= g.target);
  return {
    total: [...earned.values()].reduce((sum, n) => sum + n, 0),
    goals: list.sort((a, b) => isDone(a) - isDone(b)),
    history: history.map((p) => ({
      id: p.id,
      goalId: p.goalId,
      reason: p.reason,
      points: p.points,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export async function createGoal(studentId: string, data: GoalData) {
  await prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    if ((await tx.homeGoal.count({ where: { studentId } })) >= MAX_GOALS) {
      throw new HttpError(409, `Целей может быть не больше ${MAX_GOALS}. Удалите достигнутые`);
    }
    await tx.homeGoal.create({ data: { ...data, studentId } });
  });
}

async function childGoal(studentId: string, goalId: string, client: Pick<typeof prisma, 'homeGoal'> = prisma) {
  const goal = await client.homeGoal.findFirst({ where: { id: goalId, studentId } });
  if (!goal) throw notFound('Цель не найдена');
  return goal;
}

export async function updateGoal(studentId: string, goalId: string, data: GoalData) {
  const goal = await childGoal(studentId, goalId);
  await prisma.homeGoal.update({ where: { id: goal.id }, data });
}

/** Начисления остаются в истории и общей сумме: ребёнок их заработал */
export async function deleteGoal(studentId: string, goalId: string) {
  const goal = await childGoal(studentId, goalId);
  await prisma.homeGoal.delete({ where: { id: goal.id } });
}

export async function addPoints(studentId: string, { goalId, reason, points }: PointData) {
  await prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    if (!goalId) {
      await tx.homePoint.create({ data: { studentId, reason, points } });
      return;
    }
    const goal = await childGoal(studentId, goalId, tx);
    const { _sum } = await tx.homePoint.aggregate({ where: { goalId }, _sum: { points: true } });
    if ((_sum.points ?? 0) >= goal.target) throw new HttpError(409, 'Эта цель уже достигнута');
    await tx.homePoint.create({ data: { studentId, goalId, reason: reason || goal.title, points } });
  });
}

/** Отмена ошибочного начисления. Цель снова становится незавершённой, если баллов перестало хватать */
export async function deletePoint(studentId: string, pointId: string) {
  const { count } = await prisma.homePoint.deleteMany({ where: { id: pointId, studentId } });
  if (!count) throw notFound('Начисление не найдено');
}
