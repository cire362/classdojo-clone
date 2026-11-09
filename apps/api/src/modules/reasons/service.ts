import type { Reason } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { ARCHIVED_MESSAGE, groupsOf } from '../access/index.js';
import { copySchoolReasons } from './school.service.js';

type Tx = Prisma.TransactionClient | typeof prisma;
const KIND = { select: { kind: true } } as const;

export const DEFAULT_REASONS: ReadonlyArray<{ name: string; emoji: string; value: number }> = [
  { name: 'Работал на уроке', emoji: 'lightning', value: 1 },
  { name: 'Правильный ответ', emoji: 'lightbulb', value: 1 },
  { name: 'Помог другу', emoji: 'handshake', value: 1 },
  { name: 'Командная работа', emoji: 'puzzle', value: 1 },
  { name: 'Аккуратность', emoji: 'sparkle', value: 1 },
  { name: 'Отличная работа', emoji: 'star', value: 2 },
  { name: 'Опоздал', emoji: 'alarm', value: -1 },
  { name: 'Отвлекался', emoji: 'moon', value: -1 },
  { name: 'Не выполнил задание', emoji: 'notebook', value: -1 },
  { name: 'Шумел', emoji: 'megaphone', value: -1 },
];

/** Колледж и вуз: занятия вместо уроков, одногруппники вместо друзей, без детских формулировок */
export const ADULT_REASONS: ReadonlyArray<{ name: string; emoji: string; value: number }> = [
  { name: 'Активная работа на занятии', emoji: 'lightning', value: 1 },
  { name: 'Правильный ответ', emoji: 'lightbulb', value: 1 },
  { name: 'Помощь одногруппнику', emoji: 'handshake', value: 1 },
  { name: 'Работа в команде', emoji: 'puzzle', value: 1 },
  { name: 'Задание сдано в срок', emoji: 'calendar-check', value: 1 },
  { name: 'Отличный проект', emoji: 'star', value: 2 },
  { name: 'Опоздание', emoji: 'alarm', value: -1 },
  { name: 'Посторонние дела на занятии', emoji: 'phone-slash', value: -1 },
  { name: 'Задание не сдано', emoji: 'notebook', value: -1 },
  { name: 'Шум на занятии', emoji: 'megaphone', value: -1 },
];
/** Причины, которые считаются помощью для значка «Надёжный друг» */
const HELP_REASONS = new Set(['Помог другу', 'Помощь одногруппнику']);

type ReasonData = Omit<Reason, 'id'>;

const reasonView = (r: Reason & { schoolReasonId?: string | null }): Reason => ({
  id: r.id, name: r.name, emoji: r.emoji, value: r.value, countsForHelpBadge: r.countsForHelpBadge, school: !!r.schoolReasonId,
});

export const ATTENDANCE_REASON = { name: 'Посещение', emoji: 'check', value: 1 } as const;

/** Создаёт набор причин по умолчанию, общие причины школы и системную причину «Посещение» */
export async function createDefaultReasons(tx: Prisma.TransactionClient, groupId: string): Promise<void> {
  const { teacher } = await tx.group.findUniqueOrThrow({ where: { id: groupId }, select: { teacher: { select: { school: KIND } } } });
  const defaults = teacher.school.kind === 'SCHOOL' ? DEFAULT_REASONS : ADULT_REASONS;
  await tx.behaviorReason.createMany({
    data: [
      ...defaults.map((r, i) => ({ ...r, groupId, sortOrder: i, countsForHelpBadge: HELP_REASONS.has(r.name) })),
      { ...ATTENDANCE_REASON, groupId, kind: 'ATTENDANCE' as const, sortOrder: 1000 },
    ],
  });
  await copySchoolReasons(tx, groupId);
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
  if (reason.schoolReasonId) throw new HttpError(409, 'Это общая причина учреждения: её меняет администрация');
  return reason;
}

export async function updateReason(reasonId: string, data: ReasonData): Promise<Reason> {
  return reasonView(await prisma.behaviorReason.update({ where: { id: reasonId }, data }));
}

/** Архивируем: в истории начислений остаются название и эмодзи */
export async function archiveReason(reasonId: string) {
  await prisma.behaviorReason.update({ where: { id: reasonId }, data: { archived: true } });
}

/** Действующая ручная причина одной из групп: по ней начисляет поток */
export async function manualReason(reasonId: string, groupIds: string[]) {
  const reason = await prisma.behaviorReason.findFirst({
    where: { id: reasonId, groupId: { in: groupIds }, kind: 'MANUAL', archived: false },
  });
  if (!reason) throw notFound('Причина не найдена');
  return reason;
}

/** Такая же причина в другой группе (по названию и значению); если её нет, создаётся копия */
export async function matchingReason(
  groupId: string,
  source: { groupId: string; id: string; name: string; emoji: string; value: number; countsForHelpBadge: boolean },
) {
  if (source.groupId === groupId) return source.id;
  const found = await prisma.behaviorReason.findFirst({ where: { ...activeManual(groupId), name: source.name, value: source.value } });
  if (found) return found.id;
  const { emoji, name, value, countsForHelpBadge } = source;
  return (await addReason(groupId, { emoji, name, value, countsForHelpBadge })).id;
}
