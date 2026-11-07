import type { AuthUser } from '../../platform/auth.js';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { terms } from '../../platform/terms.js';
import { cap } from '@heroes/shared/terms';

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
  if (!student) throw notFound(`${cap(terms().student.one.nom)} не найден`);
  return student;
}

/** Записи, зависящие от состояния группы, сериализуются: начисление не попадёт в удалённую цель, план не потеряет правку соавтора. */
export async function lockGroup(tx: Prisma.TransactionClient, groupId: string) {
  const rows = await tx.$queryRaw<{ archivedAt: Date | null }[]>`SELECT "archivedAt" FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
  if (!rows.length) throw notFound('Группа не найдена');
  if (rows[0].archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
}

/**
 * Изменения администрации и заявок школы сериализуются: два директора не понизят друг друга одновременно,
 * а число ждущих заявок не превысит предел
 */
export async function lockSchool(tx: Prisma.TransactionClient, schoolId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "School" WHERE id = ${schoolId} FOR UPDATE`;
  if (!rows.length) throw notFound('Учреждение не найдено');
}

/**
 * Учреждения, чью ленту и ящик видит пользователь: администрация и преподаватель — своё, родитель — те,
 * где учатся его дети (по действующим группам), студент колледжа и вуза — своё. Школьник их не видит:
 * в школе это канал «школа — семья».
 */
export async function schoolsOf(user: AuthUser): Promise<string[]> {
  if (user.role === 'ADMIN' || user.role === 'TEACHER') return user.schoolId ? [user.schoolId] : [];
  // Школьник остаётся вне канала «школа — семья», студент колледжа и вуза читает и пишет сам
  if (user.studentId) {
    if (!user.institution || user.institution === 'SCHOOL') return [];
    const where = { students: { some: { id: user.studentId } }, archivedAt: null };
    const group = await prisma.group.findFirst({ where, select: { teacher: { select: { schoolId: true } } } });
    return group ? [group.teacher.schoolId] : [];
  }
  if (!user.parentId) return [];
  const where = { groups: { some: { archivedAt: null, students: { some: { parents: { some: { parentId: user.parentId } } } } } } };
  const rows = await prisma.teacher.findMany({ where, select: { schoolId: true }, distinct: ['schoolId'] });
  return rows.map((r) => r.schoolId);
}

/** Ленту школы и её файлы видят только её читатели; остальным школа как несуществующая */
export async function schoolReader(user: AuthUser, schoolId: string) {
  if (!(await schoolsOf(user)).includes(schoolId)) throw notFound('Не найдено');
}

/**
 * Переписку с администрацией видят администрация этого учреждения и её автор (родитель или студент), пока связан
 * с учреждением. Остальным она как несуществующая
 */
export async function schoolThreadReader(user: AuthUser, thread: { schoolId: string; accountId: string }) {
  if (user.role === 'ADMIN' && user.schoolId === thread.schoolId) return;
  if (user.accountId === thread.accountId && (await schoolsOf(user)).includes(thread.schoolId)) return;
  throw notFound('Не найдено');
}

/** Конструктор героя и магазин наград закрыты, если в группе ученика герои выключены */
export async function ensureHeroes(studentId: string) {
  const { group } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { group: { select: { heroes: true } } } });
  if (!group.heroes) throw new HttpError(403, 'В вашей группе герои и награды выключены');
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
  if (user.studentId !== studentId) throw notFound(`${cap(terms().student.one.nom)} не найден`);
}

/** Участник переписки о ребёнке: преподаватель его группы или этот родитель, пока он привязан к ребёнку */
export async function threadReader(user: AuthUser, studentId: string, parentId: string | null) {
  if (user.teacherId) return void (await teacherStudent(user, studentId));
  // Ветку самого студента видят преподаватели его группы и он сам
  if (parentId === null) {
    if (user.studentId !== studentId) throw notFound('Переписка не найдена');
    return;
  }
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
  if (!link) throw notFound(`${cap(terms().student.one.nom)} не найден`);
  return studentId;
}
