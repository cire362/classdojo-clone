import type { AuthUser } from '../auth.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../lib/errors.js';

/**
 * Проверки владения. Чужие группы и ученики выглядят для преподавателя как
 * несуществующие (404), чтобы не раскрывать их наличие.
 */
export async function teacherGroup(user: AuthUser, groupId: string) {
  if (!user.teacherId) throw new HttpError(403, 'Недостаточно прав');
  const group = await prisma.group.findFirst({ where: { id: groupId, teacherId: user.teacherId } });
  if (!group) throw notFound('Группа не найдена');
  return group;
}

export async function teacherStudent(user: AuthUser, studentId: string) {
  if (!user.teacherId) throw new HttpError(403, 'Недостаточно прав');
  const student = await prisma.student.findFirst({
    where: { id: studentId, group: { teacherId: user.teacherId } },
    include: { account: { select: { login: true } }, group: true },
  });
  if (!student) throw notFound('Ученик не найден');
  return student;
}
