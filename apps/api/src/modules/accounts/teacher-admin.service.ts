import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';

/**
 * Администрация управляет доступом преподавателя: отключает вход, передаёт его группы коллеге и удаляет
 * учётную запись. Удалить можно только преподавателя без своих групп, чтобы ученики не остались без группы.
 */

async function schoolTeacher(schoolId: string, teacherId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, pendingSince: null },
    select: { id: true, accountId: true },
  });
  if (!teacher) throw notFound('Преподаватель не найден');
  return teacher;
}

/** Отключённый не входит и сразу выходит на всех устройствах; группы и записи остаются */
export async function setTeacherDisabled(schoolId: string, teacherId: string, disabled: boolean) {
  const teacher = await schoolTeacher(schoolId, teacherId);
  await prisma.$transaction([
    prisma.teacher.update({ where: { id: teacher.id }, data: { disabledAt: disabled ? new Date() : null } }),
    ...(disabled ? [prisma.session.deleteMany({ where: { accountId: teacher.accountId } })] : []),
  ]);
}

/**
 * Все свои группы преподавателя переходят коллеге. Если коллега был в группе соавтором, он становится создателем;
 * дисциплины, которые вёл прежний преподаватель, тоже переходят к нему
 */
export async function transferTeacherGroups(schoolId: string, fromId: string, toId: string) {
  if (fromId === toId) throw new HttpError(400, 'Выберите другого преподавателя');
  const [from, to] = await Promise.all([schoolTeacher(schoolId, fromId), schoolTeacher(schoolId, toId)]);
  const target = await prisma.teacher.findUniqueOrThrow({ where: { id: to.id }, select: { disabledAt: true } });
  if (target.disabledAt) throw new HttpError(409, 'Вход этого преподавателя отключён. Выберите другого');
  return prisma.$transaction(async (tx) => {
    const groups = await tx.group.findMany({ where: { teacherId: from.id }, select: { id: true } });
    const ids = groups.map((g) => g.id);
    await tx.groupTeacher.deleteMany({ where: { groupId: { in: ids }, teacherId: to.id } });
    await tx.group.updateMany({ where: { id: { in: ids } }, data: { teacherId: to.id } });
    await tx.groupSubject.updateMany({ where: { groupId: { in: ids }, teacherId: from.id }, data: { teacherId: to.id } });
    return { moved: ids.length };
  });
}

/** Удаление учётной записи: только без своих групп. Соавторство, потоки и сообщения преподавателя удаляются */
export async function deleteTeacher(schoolId: string, teacherId: string) {
  const teacher = await schoolTeacher(schoolId, teacherId);
  if (await prisma.group.count({ where: { teacherId: teacher.id } })) {
    throw new HttpError(409, 'Сначала передайте группы преподавателя коллеге');
  }
  await prisma.account.delete({ where: { id: teacher.accountId } });
}
