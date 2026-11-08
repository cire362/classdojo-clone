import type { GroupSubject, Subject, SubjectSummary } from '@heroes/shared/api';
import { dbDate, localDayStart, addDays } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { HttpError, isUniqueViolation, notFound } from '../../platform/errors.js';

/**
 * Дисциплины: каталог учреждения и дисциплины группы с преподавателями. Преподаватель дисциплины становится
 * соавтором группы: так он ведёт уроки и видит учеников по общим правилам доступа. Баллы и отметки урока
 * помнят дисциплину, по ней строится сводка.
 */
export async function schoolSubjects(schoolId: string): Promise<Subject[]> {
  const rows = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, _count: { select: { groups: true } } },
  });
  return rows.map((s) => ({ id: s.id, name: s.name, groups: s._count.groups }));
}

export async function addSubject(schoolId: string, name: string) {
  try {
    await prisma.subject.create({ data: { schoolId, name } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'Такая дисциплина уже есть');
    throw err;
  }
  return schoolSubjects(schoolId);
}

export async function renameSubject(schoolId: string, id: string, name: string) {
  try {
    const { count } = await prisma.subject.updateMany({ where: { id, schoolId }, data: { name } });
    if (!count) throw notFound('Дисциплина не найдена');
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'Такая дисциплина уже есть');
    throw err;
  }
  return schoolSubjects(schoolId);
}

/** Дисциплина уходит из групп; баллы и отметки остаются, только без дисциплины */
export async function deleteSubject(schoolId: string, id: string) {
  const { count } = await prisma.subject.deleteMany({ where: { id, schoolId } });
  if (!count) throw notFound('Дисциплина не найдена');
  return schoolSubjects(schoolId);
}

/** Подтверждённые преподаватели учреждения — для выбора преподавателя дисциплины */
export async function schoolTeachers(schoolId: string) {
  return prisma.teacher.findMany({
    where: { schoolId, pendingSince: null, disabledAt: null },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true },
  });
}

export async function groupSubjects(groupId: string): Promise<GroupSubject[]> {
  const rows = await prisma.groupSubject.findMany({
    where: { groupId },
    orderBy: { subject: { name: 'asc' } },
    select: { id: true, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true } } },
  });
  return rows;
}

/** Учреждение группы — учреждение её создателя */
const schoolOfGroup = async (groupId: string) =>
  (await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { teacher: { select: { schoolId: true } } } })).teacher.schoolId;

export async function setGroupSubject(group: { id: string; teacherId: string }, subjectId: string, teacherId: string) {
  const schoolId = await schoolOfGroup(group.id);
  if (!(await prisma.subject.count({ where: { id: subjectId, schoolId } }))) throw notFound('Дисциплина не найдена');
  if (!(await prisma.teacher.count({ where: { id: teacherId, schoolId, pendingSince: null } }))) throw notFound('Преподаватель не найден');
  await prisma.$transaction(async (tx) => {
    await tx.groupSubject.upsert({
      where: { groupId_subjectId: { groupId: group.id, subjectId } },
      create: { groupId: group.id, subjectId, teacherId },
      update: { teacherId },
    });
    // Преподаватель дисциплины ведёт группу как соавтор
    if (teacherId !== group.teacherId) {
      await tx.groupTeacher.createMany({ data: [{ groupId: group.id, teacherId }], skipDuplicates: true });
    }
  });
  return groupSubjects(group.id);
}

/** Дисциплина уходит из группы; доступ преподавателя-соавтора убирается отдельно, в составе преподавателей */
export async function removeGroupSubject(groupId: string, id: string) {
  const { count } = await prisma.groupSubject.deleteMany({ where: { id, groupId } });
  if (!count) throw notFound('Дисциплина не найдена');
  return groupSubjects(groupId);
}

/** Дисциплина начисления или отметки должна вестись в этой группе */
export async function checkGroupSubject(groupId: string, subjectId: string | null | undefined) {
  if (!subjectId) return null;
  if (!(await prisma.groupSubject.count({ where: { groupId, subjectId } }))) throw notFound('Дисциплина не ведётся в этой группе');
  return subjectId;
}

/** Сводка группы по дисциплинам за период (даты включительно, по времени учреждения) */
export async function subjectSummary(groupId: string, from: string, to: string): Promise<SubjectSummary[]> {
  const [subjects, sessions, points] = await Promise.all([
    groupSubjects(groupId),
    prisma.attendanceSession.findMany({
      where: { groupId, date: { gte: dbDate(from), lte: dbDate(to) } },
      select: { subjectId: true, studentsTotal: true, _count: { select: { records: { where: { present: true } } } } },
    }),
    prisma.pointEvent.groupBy({
      by: ['subjectId'],
      where: { awardedGroupId: groupId, createdAt: { gte: localDayStart(from), lt: addDays(localDayStart(to), 1) } },
      _sum: { value: true },
      _count: true,
    }),
  ]);
  const lost = await prisma.pointEvent.groupBy({
    by: ['subjectId'],
    where: { awardedGroupId: groupId, value: { lt: 0 }, createdAt: { gte: localDayStart(from), lt: addDays(localDayStart(to), 1) } },
    _sum: { value: true },
  });
  const row = (subject: { id: string; name: string } | null): SubjectSummary => {
    const id = subject?.id ?? null;
    const own = sessions.filter((s) => s.subjectId === id);
    const total = own.reduce((sum, s) => sum + s.studentsTotal, 0);
    const present = own.reduce((sum, s) => sum + s._count.records, 0);
    const net = points.find((p) => p.subjectId === id)?._sum.value ?? 0;
    const minus = -(lost.find((p) => p.subjectId === id)?._sum.value ?? 0);
    return { subject, lessons: own.length, attendance: total ? present / total : null, earned: net + minus, lost: minus };
  };
  const rows = subjects.map((s) => row(s.subject));
  const other = row(null);
  return other.lessons || other.earned || other.lost ? [...rows, other] : rows;
}

/** Дисциплина своего учреждения или пусто */
export async function checkSchoolSubject(schoolId: string | null, subjectId: string | null) {
  if (!subjectId) return null;
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: schoolId ?? '' }, select: { id: true } });
  if (!subject) throw notFound('Дисциплина не найдена');
  return subject.id;
}

/** Группы, где ведётся дисциплина: поток пишет её только туда, иначе баллы выпали бы из сводки группы */
export async function groupsWithSubject(subjectId: string | null, groupIds: string[]) {
  if (!subjectId) return new Set<string>();
  const rows = await prisma.groupSubject.findMany({ where: { subjectId, groupId: { in: groupIds } }, select: { groupId: true } });
  return new Set(rows.map((r) => r.groupId));
}
