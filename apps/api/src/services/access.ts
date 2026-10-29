import type { AuthUser } from '../auth.js';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../lib/errors.js';

/**
 * Проверки владения. Чужие группы и ученики выглядят для преподавателя как
 * несуществующие (404), чтобы не раскрывать их наличие.
 */
export const ARCHIVED_MESSAGE = 'Группа в архиве. Верните её из архива, чтобы вносить изменения';

/** Условие «группа доступна преподавателю» — единое для всех запросов */
export function groupsOf(teacherId: string): Prisma.GroupWhereInput {
  return { teacherId };
}

/** writable: true — для изменений, которые запрещены в архивной группе */
export async function teacherGroup(user: AuthUser, groupId: string, opts: { writable?: boolean } = {}) {
  if (!user.teacherId) throw new HttpError(403, 'Недостаточно прав');
  const group = await prisma.group.findFirst({ where: { id: groupId, ...groupsOf(user.teacherId) } });
  if (!group) throw notFound('Группа не найдена');
  if (opts.writable && group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
  return group;
}

export async function teacherStudent(user: AuthUser, studentId: string) {
  if (!user.teacherId) throw new HttpError(403, 'Недостаточно прав');
  const student = await prisma.student.findFirst({
    where: { id: studentId, group: groupsOf(user.teacherId) },
    include: { account: { select: { login: true } }, group: true },
  });
  if (!student) throw notFound('Ученик не найден');
  return student;
}
