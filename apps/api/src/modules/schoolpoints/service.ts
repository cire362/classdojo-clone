import type { ClassRatingRow, RatingPeriod, SchoolGoal, SchoolPoints } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { startOfDay, startOfWeek } from '../../platform/dates.js';
import { groupsOf, lockSchool } from '../access/index.js';

/**
 * Баллы школы: общая цель и рейтинг классов. Считаются только плюсы, как у уровней и цели класса, и только
 * суммы по классам: отдельные дети в рейтинге не видны и между собой не сравниваются.
 * Баллы относятся к группе, где их начислили (awardedGroupId), поэтому перевод ученика их не переносит.
 */
const inSchool = (schoolId: string) => ({ awardedGroup: { teacher: { schoolId } }, value: { gt: 0 } });

export async function schoolGoal(schoolId: string): Promise<SchoolGoal | null> {
  const goal = await prisma.schoolGoal.findUnique({ where: { schoolId } });
  if (!goal) return null;
  const where = { ...inSchool(schoolId), createdAt: { gte: goal.createdAt } };
  const { _sum } = await prisma.pointEvent.aggregate({ where, _sum: { value: true } });
  const earned = _sum.value ?? 0;
  return {
    id: goal.id, title: goal.title, target: goal.target, earned, reached: earned >= goal.target, createdAt: goal.createdAt.toISOString(),
  };
}

/** Правка сохраняет накопленное; новая цель (restart) начинает счёт заново, история баллов не меняется */
export async function saveSchoolGoal(schoolId: string, data: { title: string; target: number }, restart = false) {
  await prisma.$transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    if (restart) await tx.schoolGoal.deleteMany({ where: { schoolId } });
    await tx.schoolGoal.upsert({ where: { schoolId }, create: { schoolId, ...data }, update: data });
  });
  return schoolGoal(schoolId);
}

export async function removeSchoolGoal(schoolId: string) {
  await prisma.schoolGoal.deleteMany({ where: { schoolId } });
}

/** Начало периода по времени школы: неделя с понедельника, месяц с первого числа */
export function periodStart(period: RatingPeriod, now = new Date()) {
  if (period === 'week') return startOfWeek(now);
  const day = startOfDay(now);
  day.setDate(1);
  return day;
}

/**
 * Рейтинг действующих классов школы по плюсам на ученика: так большой класс не выигрывает числом.
 * Равные места делятся. mine — группы смотрящего преподавателя
 */
export async function classRating(schoolId: string, period: RatingPeriod, mine: Set<string> = new Set()): Promise<ClassRatingRow[]> {
  const from = periodStart(period);
  const groups = await prisma.group.findMany({
    where: { archivedAt: null, teacher: { schoolId }, students: { some: {} } },
    select: { id: true, name: true, teacher: { select: { name: true } }, _count: { select: { students: true } } },
  });
  const sums = await prisma.pointEvent.groupBy({
    by: ['awardedGroupId'],
    where: { ...inSchool(schoolId), awardedGroupId: { in: groups.map((g) => g.id) }, createdAt: { gte: from } },
    _sum: { value: true },
  });
  const earned = new Map(sums.map((s) => [s.awardedGroupId, s._sum.value ?? 0]));
  const rows = groups
    .map((g) => {
      const total = earned.get(g.id) ?? 0;
      const students = g._count.students;
      return {
        groupId: g.id,
        groupName: g.name,
        teacherName: g.teacher.name,
        students,
        earned: total,
        perStudent: Math.round((total / students) * 10) / 10,
        place: 0,
        mine: mine.has(g.id),
      };
    })
    .sort((a, b) => b.perStudent - a.perStudent || a.groupName.localeCompare(b.groupName, 'ru'));
  rows.forEach((row, i) => {
    row.place = i > 0 && rows[i - 1].perStudent === row.perStudent ? rows[i - 1].place : i + 1;
  });
  return rows;
}

export async function schoolPoints(schoolId: string, period: RatingPeriod, mine?: Set<string>): Promise<SchoolPoints> {
  const [goal, rating] = await Promise.all([schoolGoal(schoolId), classRating(schoolId, period, mine)]);
  return { goal, period, from: periodStart(period).toISOString(), rating };
}

/** Группы преподавателя для отметки «ваш класс» */
export async function teacherGroupIds(teacherId: string) {
  const rows = await prisma.group.findMany({ where: groupsOf(teacherId), select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

/** Школа ученика — школа создателя его группы */
export async function studentSchoolGoal(studentId: string) {
  const select = { group: { select: { teacher: { select: { schoolId: true } } } } };
  const { group } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select });
  return schoolGoal(group.teacher.schoolId);
}
