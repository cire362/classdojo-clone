import type { Reason } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { ARCHIVED_MESSAGE, groupsOf } from '../access/index.js';

type Tx = Prisma.TransactionClient | typeof prisma;

export const DEFAULT_REASONS: ReadonlyArray<{ name: string; emoji: string; value: number }> = [
  { name: 'Работал на уроке', emoji: '💪', value: 1 },
  { name: 'Правильный ответ', emoji: '💡', value: 1 },
  { name: 'Помог другу', emoji: '🤝', value: 1 },
  { name: 'Командная работа', emoji: '🧩', value: 1 },
  { name: 'Аккуратность', emoji: '✨', value: 1 },
  { name: 'Отличная работа', emoji: '⭐', value: 2 },
  { name: 'Опоздал', emoji: '⏰', value: -1 },
  { name: 'Отвлекался', emoji: '💤', value: -1 },
  { name: 'Не выполнил задание', emoji: '📕', value: -1 },
  { name: 'Шумел', emoji: '📢', value: -1 },
];

type ReasonData = Omit<Reason, 'id'>;

const reasonView = (r: Reason): Reason => ({
  id: r.id, name: r.name, emoji: r.emoji, value: r.value, countsForHelpBadge: r.countsForHelpBadge,
});

export const ATTENDANCE_REASON = { name: 'Посещение', emoji: '✅', value: 1 } as const;

/** Создаёт набор причин по умолчанию и системную причину «Посещение» */
export async function createDefaultReasons(tx: Tx, groupId: string): Promise<void> {
  await tx.behaviorReason.createMany({
    data: [
      ...DEFAULT_REASONS.map((r, i) => ({ ...r, groupId, sortOrder: i, countsForHelpBadge: r.name === 'Помог другу' })),
      { ...ATTENDANCE_REASON, groupId, kind: 'ATTENDANCE' as const, sortOrder: 1000 },
    ],
  });
}

export async function attendanceReason(tx: Tx, groupId: string) {
  const existing = await tx.behaviorReason.findFirst({ where: { groupId, kind: 'ATTENDANCE' } });
  if (existing) return existing;
  return tx.behaviorReason.create({ data: { ...ATTENDANCE_REASON, groupId, kind: 'ATTENDANCE', sortOrder: 1000 } });
}

const activeManual = (groupId: string) => ({ groupId, kind: 'MANUAL' as const, archived: false });

export async function manualReasons(groupId: string): Promise<Reason[]> {
  const reasons = await prisma.behaviorReason.findMany({
    where: activeManual(groupId),
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return reasons.map(reasonView);
}

export async function addReason(groupId: string, data: ReasonData): Promise<Reason> {
  const max = await prisma.behaviorReason.aggregate({
    where: { groupId, kind: 'MANUAL' },
    _max: { sortOrder: true },
  });
  return reasonView(await prisma.behaviorReason.create({ data: { ...data, groupId, sortOrder: (max._max.sortOrder ?? 0) + 1 } }));
}

/** Новый порядок: полный список активных причин группы в нужном порядке */
export async function reorderReasons(groupId: string, reasonIds: string[]) {
  const active = await prisma.behaviorReason.findMany({ where: activeManual(groupId), select: { id: true } });
  const activeIds = new Set(active.map((r) => r.id));
  if (new Set(reasonIds).size !== reasonIds.length || reasonIds.length !== activeIds.size || reasonIds.some((r) => !activeIds.has(r))) {
    throw new HttpError(409, 'Список причин изменился, обновите страницу');
  }
  await prisma.$transaction(reasonIds.map((id, i) => prisma.behaviorReason.update({ where: { id }, data: { sortOrder: i } })));
}

export async function ownedReason(teacherId: string, reasonId: string) {
  const reason = await prisma.behaviorReason.findFirst({
    where: { id: reasonId, kind: 'MANUAL', archived: false, group: groupsOf(teacherId) },
    include: { group: { select: { archivedAt: true } } },
  });
  if (!reason) throw notFound('Причина не найдена');
  if (reason.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
  return reason;
}

export async function updateReason(reasonId: string, data: ReasonData): Promise<Reason> {
  return reasonView(await prisma.behaviorReason.update({ where: { id: reasonId }, data }));
}

/** Архивируем: в истории начислений остаются название и эмодзи */
export async function archiveReason(reasonId: string) {
  await prisma.behaviorReason.update({ where: { id: reasonId }, data: { archived: true } });
}
