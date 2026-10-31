import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../platform/db.js';
import { HttpError, notFound } from '../platform/errors.js';
import { markRewardNotificationsRead } from './studentNotifications.js';
import { groupsOf } from '../modules/access/index.js';

/**
 * Магазин наград. Баланс = все баллы (плюсы минус минусы) минус потраченное на награды.
 * Запрос сразу занимает баллы (PENDING), отказ их возвращает. Уровень от трат не падает:
 * он считается по заработанным баллам.
 */
type Tx = Prisma.TransactionClient | typeof prisma;

/** Только запросы, на которые преподаватель сейчас может ответить. После перевода — в новой группе ученика. */
export function pendingRequestsOf(teacherId: string): Prisma.RewardRequestWhereInput {
  return { status: 'PENDING', student: { group: { ...groupsOf(teacherId), archivedAt: null } } };
}

export async function pendingRewardGroups(teacherId: string) {
  const groups = await prisma.group.findMany({
    where: { ...groupsOf(teacherId), archivedAt: null, students: { some: { rewardRequests: { some: { status: 'PENDING' } } } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true, name: true,
      students: {
        where: { rewardRequests: { some: { status: 'PENDING' } } },
        select: { _count: { select: { rewardRequests: { where: { status: 'PENDING' } } } } },
      },
    },
  });
  const items = groups.map(({ id, name, students }) => ({ id, name, count: students.reduce((sum, s) => sum + s._count.rewardRequests, 0) })).filter((g) => g.count > 0);
  return { groups: items, total: items.reduce((sum, g) => sum + g.count, 0) };
}

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
  const through = new Date();
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true, group: { select: { archivedAt: true } } } });
  const [rewards, requests, bal] = await Promise.all([
    groupRewards(s.groupId),
    prisma.rewardRequest.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 50, select: requestView }),
    balance(studentId),
  ]);
  await markRewardNotificationsRead(studentId, through);
  return { balance: bal, archived: !!s.group.archivedAt, rewards, requests };
}

/** Родитель только смотрит: уведомления ученика не читаются, ожидающие запросы не ограничены историей. */
export async function parentRewards(studentId: string, before?: string) {
  let cursor: { at: Date; id: string } | null = null;
  if (before !== undefined) {
    const [time, id, extra] = before.split('|');
    const at = new Date(time);
    if (before.length > 128 || !Number.isFinite(+at) || at.toISOString() !== time || !id || id.length > 64 || extra !== undefined) {
      throw new HttpError(400, 'Некорректная страница истории наград');
    }
    cursor = { at, id };
  }
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUniqueOrThrow({
      where: { id: studentId }, select: { id: true, name: true, groupId: true, group: { select: { name: true, archivedAt: true } } },
    });
    const [rewards, pending, rows, bal] = await Promise.all([
      tx.reward.findMany({ where: { groupId: student.groupId, archived: false }, orderBy: [{ cost: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, title: true, emoji: true, cost: true } }),
      tx.rewardRequest.findMany({ where: { studentId, status: 'PENDING' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: requestView }),
      tx.rewardRequest.findMany({
        where: { studentId, status: { not: 'PENDING' }, ...(cursor ? { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21, select: requestView,
      }),
      balance(studentId, tx),
    ]);
    const history = rows.slice(0, 20);
    const last = history.at(-1);
    return {
      student: { id: student.id, name: student.name, groupName: student.group.name },
      balance: bal, archived: !!student.group.archivedAt, rewards, pending, history,
      nextCursor: rows.length > 20 && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }, { isolationLevel: 'RepeatableRead' });
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
  const select = { ...requestView, student: { select: { id: true, name: true } } } as const;
  // История не должна вытеснять старые ожидающие запросы, на которые указывает значок.
  const [pending, done] = await prisma.$transaction([
    prisma.rewardRequest.findMany({ where: { student: { groupId }, status: 'PENDING' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select }),
    prisma.rewardRequest.findMany({ where: { student: { groupId }, status: { not: 'PENDING' } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100, select }),
  ], { isolationLevel: 'RepeatableRead' });
  return [...pending, ...done];
}

export async function decideRequest(groupId: string, requestId: string, accountId: string, approve: boolean) {
  const { count } = await prisma.rewardRequest.updateMany({
    where: { id: requestId, status: 'PENDING', student: { groupId } },
    data: { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date(), decidedById: accountId },
  });
  if (!count) throw notFound('Запрос не найден или уже рассмотрен');
}
