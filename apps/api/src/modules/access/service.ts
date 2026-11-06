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

/** Записи, зависящие от состояния группы, сериализуются: начисление не попадёт в удалённую цель, план не потеряет правку соавтора. */
export async function lockGroup(tx: Prisma.TransactionClient, groupId: string) {
  const rows = await tx.$queryRaw<{ archivedAt: Date | null }[]>`SELECT "archivedAt" FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
  if (!rows.length) throw notFound('Группа не найдена');
  if (rows[0].archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
}

/** Преподаватель группы, её ученик или родитель её ученика, иначе 404 */
export async function groupReader(user: AuthUser, groupId: string) {
  if (user.teacherId) return void (await teacherGroup(user, groupId));
  const member = await prisma.student.findFirst({
    where: { groupId, OR: [{ id: user.studentId ?? '' }, { parents: { some: { parentId: user.parentId ?? '' } } }] },
    select: { id: true },
  });
  if (!member) throw notFound('Группа не найдена');
}

/** Преподаватель ученика, сам ученик или его родитель, иначе 404 */
export async function studentReader(user: AuthUser, studentId: string) {
  if (user.teacherId) return void (await teacherStudent(user, studentId));
  if (user.parentId) return void (await parentChild(user.parentId, studentId));
  if (user.studentId !== studentId) throw notFound('Ученик не найден');
}

/** Участник переписки о ребёнке: преподаватель его группы или этот родитель, пока он привязан к ребёнку */
export async function threadReader(user: AuthUser, studentId: string, parentId: string) {
  if (user.teacherId) return void (await teacherStudent(user, studentId));
  if (user.parentId !== parentId) throw notFound('Переписка не найдена');
  await parentChild(parentId, studentId);
}

/** Рассылку видят преподаватели группы и родители, которым она пришла и которые ещё привязаны к ребёнку */
export async function broadcastReader(user: AuthUser, groupId: string, broadcastId: string) {
  if (user.teacherId) return void (await teacherGroup(user, groupId));
  const copy = await prisma.message.findFirst({
    where: { broadcastId, parentId: user.parentId ?? '', student: { groupId, parents: { some: { parentId: user.parentId ?? '' } } } },
    select: { id: true },
  });
  if (!copy) throw notFound('Рассылка не найдена');
}

/** Задание видят преподаватели группы, получившие его ученики и их родители */
export async function assignmentReader(user: AuthUser, groupId: string, assignmentId: string) {
  if (user.teacherId) return void (await teacherGroup(user, groupId));
  const receiver = await prisma.assignmentStudent.findFirst({
    where: {
      assignmentId,
      student: { groupId, OR: [{ id: user.studentId ?? '' }, { parents: { some: { parentId: user.parentId ?? '' } } }] },
    },
    select: { studentId: true },
  });
  if (!receiver) throw notFound('Задание не найдено');
}

/** Записи, зависящие от суммы по ученику, сериализуются: два запроса сразу не обойдут проверку */
export async function lockStudent(tx: Prisma.TransactionClient, studentId: string) {
  await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
}

/** Ребёнок родителя или 404: родитель не может открыть чужого ученика */
export async function parentChild(parentId: string, studentId: string): Promise<string> {
  const link = await prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
  if (!link) throw notFound('Ученик не найден');
  return studentId;
}
