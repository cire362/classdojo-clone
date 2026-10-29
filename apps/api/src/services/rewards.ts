import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../lib/errors.js';

/**
 * Магазин наград. Баланс = все баллы (плюсы минус минусы) минус потраченное на награды.
 * Запрос сразу занимает баллы (PENDING), отказ их возвращает. Уровень от трат не падает:
 * он считается по заработанным баллам.
 */
type Tx = Prisma.TransactionClient | typeof prisma;

export const DEFAULT_REWARDS = [
  { emoji: '🪑', title: 'Выбрать место на уроке', cost: 15 },
  { emoji: '🎵', title: 'Музыка на перемене', cost: 20 },
  { emoji: '🧑‍🏫', title: 'Помощник учителя на урок', cost: 30 },
  { emoji: '⏰', title: 'Отсрочка домашнего задания', cost: 50 },
];

export async function createDefaultRewards(db: Tx, groupId: string) {
  await db.reward.createMany({ data: DEFAULT_REWARDS.map((r, i) => ({ ...r, groupId, sortOrder: i })) });
}

export async function balance(studentId: string, db: Tx = prisma): Promise<number> {
  const [points, spent] = await Promise.all([
    db.pointEvent.aggregate({ where: { studentId }, _sum: { value: true } }),
    db.rewardRequest.aggregate({ where: { studentId, status: { in: ['PENDING', 'APPROVED'] } }, _sum: { cost: true } }),
  ]);
  return (points._sum.value ?? 0) - (spent._sum.cost ?? 0);
}

export function groupRewards(groupId: string) {
  return prisma.reward.findMany({
    where: { groupId, archived: false },
    orderBy: [{ cost: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, title: true, emoji: true, cost: true },
  });
}

const requestView = {
  id: true,
  title: true,
  emoji: true,
  cost: true,
  status: true,
  createdAt: true,
  decidedAt: true,
} as const;

/** Магазин для ученика: баланс, награды его группы и его запросы */
export async function studentShop(studentId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true, group: { select: { archivedAt: true } } } });
  const [rewards, requests, bal] = await Promise.all([
    groupRewards(s.groupId),
    prisma.rewardRequest.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 50, select: requestView }),
    balance(studentId),
  ]);
  return { balance: bal, archived: !!s.group.archivedAt, rewards, requests };
}

/** Ученик просит награду. Баланс проверяется под блокировкой строки ученика: два запроса сразу не потратят баллы дважды */
export async function requestReward(studentId: string, rewardId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
    const student = await tx.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true, group: { select: { archivedAt: true } } } });
    if (student.group.archivedAt) throw new HttpError(409, 'Группа в архиве: магазин закрыт');
    const reward = await tx.reward.findFirst({ where: { id: rewardId, groupId: student.groupId, archived: false } });
    if (!reward) throw notFound('Награда не найдена');
    const pending = await tx.rewardRequest.count({ where: { studentId, status: 'PENDING' } });
    if (pending >= 3) throw new HttpError(400, 'Дождись, пока преподаватель ответит на прошлые запросы');
    const bal = await balance(studentId, tx);
    if (bal < reward.cost) throw new HttpError(400, `Не хватает баллов: нужно ${reward.cost}, у тебя ${bal}`);
    await tx.rewardRequest.create({ data: { rewardId, studentId, title: reward.title, emoji: reward.emoji, cost: reward.cost } });
  });
}

/** Ученик отменяет запрос, пока преподаватель не ответил */
export async function cancelRequest(studentId: string, requestId: string) {
  const { count } = await prisma.rewardRequest.deleteMany({ where: { id: requestId, studentId, status: 'PENDING' } });
  if (!count) throw notFound('Запрос не найден или уже рассмотрен');
}

/** Запросы учеников группы: сначала ожидающие */
export async function groupRequests(groupId: string) {
  const rows = await prisma.rewardRequest.findMany({
    where: { student: { groupId } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { ...requestView, student: { select: { id: true, name: true } } },
  });
  return [...rows.filter((r) => r.status === 'PENDING').reverse(), ...rows.filter((r) => r.status !== 'PENDING')];
}

export async function decideRequest(groupId: string, requestId: string, accountId: string, approve: boolean) {
  const { count } = await prisma.rewardRequest.updateMany({
    where: { id: requestId, status: 'PENDING', student: { groupId } },
    data: { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date(), decidedById: accountId },
  });
  if (!count) throw notFound('Запрос не найден или уже рассмотрен');
}
