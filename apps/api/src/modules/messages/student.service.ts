import type { TeacherThread } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { groupsOf } from '../access/index.js';

/**
 * Ветка студента с преподавателями группы — только в колледже и вузе: студенты там совершеннолетние и пишут сами.
 * В школе переписка остаётся каналом «семья — школа», и ветки школьника нет.
 */
const ADULT = { not: 'SCHOOL' } as const;

/** Ветка студента у преподавателя: студент в его группе, учреждение — колледж или вуз */
export async function teacherStudentThread(teacherId: string, studentId: string): Promise<Omit<TeacherThread, 'messages'>> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, group: { ...groupsOf(teacherId), teacher: { school: { kind: ADULT } } } },
    select: { name: true, group: { select: { id: true, name: true, archivedAt: true } } },
  });
  if (!student) throw notFound('Переписка не найдена');
  const { group } = student;
  return { studentName: student.name, group: { ...group, archivedAt: group.archivedAt?.toISOString() ?? null }, parentLogin: null };
}

/** Студент пишет сам только в колледже и вузе */
export function ensureAdultStudent(institution: string | null) {
  if (!institution || institution === 'SCHOOL') throw new HttpError(403, 'Недостаточно прав');
}
