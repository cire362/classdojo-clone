import type { SchoolReason } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { notFound } from '../../platform/errors.js';
import { lockSchool } from '../access/index.js';

/**
 * Общие причины школы. Директор или завуч задаёт причину один раз, а в каждой группе школы появляется её копия:
 * начисление, история, значки и статистика работают с копией как с обычной причиной группы.
 * Изменение и удаление оригинала переносятся на все копии. Создание групп и причин сериализуется блокировкой школы,
 * поэтому новая группа не пропустит причину, созданную одновременно с ней.
 */
type Data = { name: string; emoji: string; value: number };

const view = (r: SchoolReason): SchoolReason => ({ id: r.id, name: r.name, emoji: r.emoji, value: r.value });

export async function schoolReasons(schoolId: string): Promise<SchoolReason[]> {
  const rows = await prisma.schoolReason.findMany({ where: { schoolId, archived: false }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return rows.map(view);
}

/** Копии в начале списка группы: преподаватель может переставить их как обычные причины */
const copyOf = (r: Data & { id: string }, groupId: string) => ({
  groupId, schoolReasonId: r.id, name: r.name, emoji: r.emoji, value: r.value, sortOrder: -1,
});

export async function addSchoolReason(schoolId: string, data: Data): Promise<SchoolReason[]> {
  await prisma.$transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    const reason = await tx.schoolReason.create({ data: { ...data, schoolId } });
    const groups = await tx.group.findMany({ where: { teacher: { schoolId } }, select: { id: true } });
    await tx.behaviorReason.createMany({ data: groups.map((g) => copyOf(reason, g.id)), skipDuplicates: true });
  });
  return schoolReasons(schoolId);
}

export async function updateSchoolReason(schoolId: string, id: string, data: Data): Promise<SchoolReason[]> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.schoolReason.updateMany({ where: { id, schoolId, archived: false }, data });
    if (!count) throw notFound('Причина не найдена');
    await tx.behaviorReason.updateMany({ where: { schoolReasonId: id, archived: false }, data });
  });
  return schoolReasons(schoolId);
}

/** Как и у причин группы: архив, чтобы история начислений сохранила названия */
export async function archiveSchoolReason(schoolId: string, id: string): Promise<SchoolReason[]> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.schoolReason.updateMany({ where: { id, schoolId, archived: false }, data: { archived: true } });
    if (!count) throw notFound('Причина не найдена');
    await tx.behaviorReason.updateMany({ where: { schoolReasonId: id }, data: { archived: true } });
  });
  return schoolReasons(schoolId);
}

/** Новая группа получает действующие причины своей школы */
export async function copySchoolReasons(tx: Prisma.TransactionClient, groupId: string) {
  const { teacher } = await tx.group.findUniqueOrThrow({ where: { id: groupId }, select: { teacher: { select: { schoolId: true } } } });
  await lockSchool(tx, teacher.schoolId);
  const reasons = await tx.schoolReason.findMany({ where: { schoolId: teacher.schoolId, archived: false } });
  if (reasons.length) await tx.behaviorReason.createMany({ data: reasons.map((r) => copyOf(r, groupId)), skipDuplicates: true });
}
