import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../platform/db.js';

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
