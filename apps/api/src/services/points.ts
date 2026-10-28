import { levelForPoints } from '@heroes/shared';
import { prisma } from '../db.js';
import { startOfDay } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';

/** Сумма заработанных (только положительных) баллов по ученикам */
export async function earnedByStudent(studentIds: string[], since?: Date): Promise<Map<string, number>> {
  if (!studentIds.length) return new Map();
  const rows = await prisma.pointEvent.groupBy({
    by: ['studentId'],
    where: { studentId: { in: studentIds }, value: { gt: 0 }, ...(since ? { createdAt: { gte: since } } : {}) },
    _sum: { value: true },
  });
  return new Map(rows.map((r) => [r.studentId, r._sum.value ?? 0]));
}

export async function studentLevel(studentId: string) {
  const earned = (await earnedByStudent([studentId])).get(studentId) ?? 0;
  return levelForPoints(earned);
}

/** Краткая сводка для карточек: сегодня (плюсы), всего (плюсы), уровень */
export async function cardSummaries(studentIds: string[]) {
  const [total, today] = await Promise.all([earnedByStudent(studentIds), earnedByStudent(studentIds, startOfDay())]);
  return new Map(
    studentIds.map((id) => {
      const t = total.get(id) ?? 0;
      return [id, { todayEarned: today.get(id) ?? 0, totalEarned: t, level: levelForPoints(t).level }];
    }),
  );
}

/**
 * Удаление ошибочных начислений преподавателем. Чужие ученики выглядят как
 * несуществующие (404); баллы за посещение удаляются только через отметку посещаемости (409).
 */
export async function deletePointEvents(teacherId: string, eventIds: string[]) {
  const ids = [...new Set(eventIds)];
  const events = await prisma.pointEvent.findMany({
    where: { id: { in: ids }, student: { group: { teacherId } } },
    select: { id: true, studentId: true, attendanceSessionId: true },
  });
  if (events.length !== ids.length) throw new HttpError(404, 'Начисление не найдено');
  if (events.some((e) => e.attendanceSessionId)) {
    throw new HttpError(409, 'Баллы за посещение меняются через отметку посещаемости');
  }
  await prisma.pointEvent.deleteMany({ where: { id: { in: ids } } });
  return cardSummaries([...new Set(events.map((e) => e.studentId))]);
}

/**
 * Начисление/списание баллов нескольким ученикам по причине.
 * Все ученики должны быть из этой группы, причина — ручная и не в архиве.
 */
export async function awardPoints(params: {
  groupId: string;
  studentIds: string[];
  reasonId: string;
  awardedById: string;
}) {
  const studentIds = [...new Set(params.studentIds)];
  if (!studentIds.length) throw new HttpError(400, 'Не выбраны ученики');

  const reason = await prisma.behaviorReason.findFirst({
    where: { id: params.reasonId, groupId: params.groupId, kind: 'MANUAL', archived: false },
  });
  if (!reason) throw new HttpError(404, 'Причина не найдена');

  const count = await prisma.student.count({ where: { id: { in: studentIds }, groupId: params.groupId } });
  if (count !== studentIds.length) throw new HttpError(404, 'Ученик не найден в группе');

  const events = await prisma.$transaction(
    studentIds.map((studentId) =>
      prisma.pointEvent.create({
        data: {
          studentId,
          reasonId: reason.id,
          reasonName: reason.name,
          emoji: reason.emoji,
          value: reason.value,
          awardedById: params.awardedById,
        },
      }),
    ),
  );
  return { reason, events };
}
