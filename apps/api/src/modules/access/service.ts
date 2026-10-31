import type { AuthUser } from '../../platform/auth.js';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';

/**
 * Проверки владения. Чужие группы и ученики выглядят для преподавателя как
 * несуществующие (404), чтобы не раскрывать их наличие.
 */
export const ARCHIVED_MESSAGE = 'Группа в архиве. Верните её из архива, чтобы вносить изменения';

export const OWNER_ONLY_MESSAGE = 'Это может сделать только создатель группы';

/** Условие «группа доступна преподавателю» (владелец или соавтор) — единое для всех запросов */
export function groupsOf(teacherId: string): Prisma.GroupWhereInput {
  return { OR: [{ teacherId }, { coTeachers: { some: { teacherId } } }] };
}

/**
 * writable: true — для изменений, которые запрещены в архивной группе;
 * owner: true — только для создателя группы (удаление, архив, название, состав преподавателей)
 */
export async function teacherGroup(user: AuthUser, groupId: string, opts: { writable?: boolean; owner?: boolean } = {}) {
  if (!user.teacherId) throw new HttpError(403, 'Недостаточно прав');
  const group = await prisma.group.findFirst({ where: { id: groupId, ...groupsOf(user.teacherId) } });
  if (!group) throw notFound('Группа не найдена');
  const isOwner = group.teacherId === user.teacherId;
  if (opts.owner && !isOwner) throw new HttpError(403, OWNER_ONLY_MESSAGE);
  if (opts.writable && group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
  return { ...group, isOwner };
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

/** Ребёнок родителя или 404: родитель не может открыть чужого ученика */
export async function parentChild(parentId: string, studentId: string): Promise<string> {
  const link = await prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
  if (!link) throw notFound('Ученик не найден');
  return studentId;
}
