import type { GroupWork, GroupWorks, StudentWork } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { groupsOf, lockGroup } from '../access/index.js';
import { addFileRows, fileView, prepareUpload, purgeDeletedFiles, writeUploads, type Upload } from '../files/index.js';
import { addressOf, groupOfStudent, pickRecipient } from './recipients.service.js';

/**
 * Работы учеников: ученик сдаёт текст и фото или PDF, преподаватель группы публикует работу или возвращает
 * с комментарием. До одобрения работу видят только сам ученик и преподаватели группы, после — и родители.
 */
export const MAX_WORK_FILES = 5;
/** Столько работ может ждать проверки: больше — уже не работа, а поток */
export const MAX_PENDING = 10;
const DECIDED_SHOWN = 50;

const INCLUDE = {
  files: { orderBy: { position: 'asc' } },
  decidedBy: { select: { teacher: { select: { name: true } } } },
  student: { select: { id: true, name: true } },
  subject: { select: { name: true } },
  recipient: { select: { id: true, name: true } },
} as const satisfies Prisma.StudentWorkInclude;

type LoadedWork = Prisma.StudentWorkGetPayload<{ include: typeof INCLUDE }>;

/** curatorId — создатель группы, для адреса работы; без него адрес не показывается */
function workView(w: LoadedWork, curatorId?: string): StudentWork {
  return {
    id: w.id,
    title: w.title,
    text: w.text,
    status: w.status,
    comment: w.comment,
    createdAt: w.createdAt.toISOString(),
    decidedAt: w.decidedAt?.toISOString() ?? null,
    decidedBy: w.decidedBy?.teacher?.name ?? null,
    files: w.files.map(fileView),
    unseen: !!w.decidedAt && !w.seenAt,
    to: curatorId && !w.assignmentId ? addressOf(w, curatorId) : null,
  };
}

/** Работа «моя», если адресована мне; работу без адресата (преподавателя удалили) ждёт куратор */
const isMine = (w: { recipientId: string | null }, teacherId: string, curatorId: string) =>
  w.recipientId ? w.recipientId === teacherId : teacherId === curatorId;

const groupWorkView = (teacherId: string, curatorId: string) => (w: LoadedWork): GroupWork => ({
  ...workView(w, curatorId),
  student: w.student,
  mine: isMine(w, teacherId, curatorId),
});

const curatorOf = async (groupId: string) =>
  (await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { teacherId: true } })).teacherId;

/** Работы для портфолио; ответы на задания живут в модуле assignments */
const PORTFOLIO = { assignmentId: null };

/** Ответы на задания по условию, новые сверху, с файлами: для модуля assignments */
export async function findWorks(
  where: Prisma.StudentWorkWhereInput,
): Promise<(StudentWork & { studentId: string; assignmentId: string | null })[]> {
  const works = await prisma.studentWork.findMany({ where, orderBy: { createdAt: 'desc' }, include: INCLUDE });
  return works.map((w) => ({ ...workView(w), studentId: w.studentId, assignmentId: w.assignmentId }));
}

/** Работы ученика для него самого. Открытый список отмечает решения увиденными */
export async function ownWorks(studentId: string): Promise<StudentWork[]> {
  const where = { studentId, ...PORTFOLIO };
  const [works, curatorId] = await Promise.all([
    prisma.studentWork.findMany({ where, orderBy: { createdAt: 'desc' }, include: INCLUDE }),
    groupOfStudent(studentId).then(curatorOf),
  ]);
  await prisma.studentWork.updateMany({ where: { ...where, decidedAt: { not: null }, seenAt: null }, data: { seenAt: new Date() } });
  return works.map((w) => workView(w, curatorId));
}

/** Одобренные работы: их видят и родители, в портфолио профиля */
export async function approvedWorks(studentId: string): Promise<StudentWork[]> {
  const works = await prisma.studentWork.findMany({
    where: { studentId, status: 'APPROVED', ...PORTFOLIO },
    orderBy: { decidedAt: 'desc' },
    include: INCLUDE,
  });
  return works.map((w) => ({ ...workView(w), unseen: false }));
}

/**
 * Сдача работы или ответа на задание: файлы проверяются и пересобираются до транзакции, строки появляются вместе
 * с работой под блокировкой группы, поэтому место группы и пределы не обойти параллельными запросами.
 * На задание у ученика может быть только один ответ на проверке или принятый; новый — после возврата.
 * to — кому работа: преподаватель группы и его дисциплина; без выбора работа уходит куратору. У ответа на задание адресата нет.
 */
export async function createWork(
  studentId: string,
  accountId: string,
  work: { title: string; text: string; files: File[]; to?: { teacherId?: string | null; subjectId?: string | null } },
  assignmentId: string | null = null,
) {
  if (!work.text && !work.files.length) throw new HttpError(400, 'Напишите текст работы или приложите фото или файл');
  if (work.files.length > MAX_WORK_FILES) throw new HttpError(400, `К работе можно приложить не больше ${MAX_WORK_FILES} файлов`);
  const uploads: Upload[] = [];
  for (const file of work.files) uploads.push(await prepareUpload(file));
  const { groupId } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } });
  const to = assignmentId ? null : await pickRecipient(groupId, work.to ?? {});
  const { created, rows } = await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    if (assignmentId) {
      const active = await tx.studentWork.findFirst({ where: { studentId, assignmentId, status: { not: 'RETURNED' } } });
      if (active) throw new HttpError(409, active.status === 'APPROVED' ? 'Ответ уже принят' : 'Ответ уже на проверке');
    } else if ((await tx.studentWork.count({ where: { studentId, status: 'PENDING', ...PORTFOLIO } })) >= MAX_PENDING) {
      throw new HttpError(409, `На проверке уже ${MAX_PENDING} работ. Подождите, пока преподаватель их посмотрит`);
    }
    const created = await tx.studentWork.create({ data: {
      studentId, title: work.title, text: work.text, assignmentId, recipientId: to?.teacherId ?? null, subjectId: to?.subjectId ?? null,
    } });
    return { created, rows: await addFileRows(tx, groupId, { studentId }, accountId, uploads, { workId: created.id }) };
  });
  try {
    await writeUploads(rows, uploads);
  } catch (err) {
    await prisma.studentWork.delete({ where: { id: created.id } });
    await purgeDeletedFiles();
    throw err;
  }
  return created.id;
}

export async function submitWork(
  studentId: string,
  accountId: string,
  work: { title: string; text: string; files: File[]; to: { teacherId: string | null; subjectId: string | null } },
) {
  await createWork(studentId, accountId, work);
  return ownWorks(studentId);
}

/** Свою работу ученик убирает, пока она не опубликована; опубликованную снимает преподаватель */
export async function deleteOwnWork(studentId: string, id: string) {
  const { count } = await prisma.studentWork.deleteMany({ where: { id, studentId, status: { not: 'APPROVED' }, ...PORTFOLIO } });
  if (!count) throw notFound('Работа не найдена или уже опубликована');
  await purgeDeletedFiles();
  return ownWorks(studentId);
}

/** Очередь преподавателя: ждущие проверки (старые сверху) и последние решённые; mine — адресованные ему */
export async function groupWorks(groupId: string, teacherId: string): Promise<GroupWorks> {
  const [pending, decided, curatorId] = await Promise.all([
    prisma.studentWork.findMany({
      where: { student: { groupId }, status: 'PENDING', ...PORTFOLIO },
      orderBy: { createdAt: 'asc' },
      include: INCLUDE,
    }),
    prisma.studentWork.findMany({
      where: { student: { groupId }, status: { not: 'PENDING' }, ...PORTFOLIO },
      orderBy: { decidedAt: 'desc' },
      take: DECIDED_SHOWN,
      include: INCLUDE,
    }),
    curatorOf(groupId),
  ]);
  const view = groupWorkView(teacherId, curatorId);
  return { pending: pending.map(view), decided: decided.map(view) };
}

/** Сколько работ ждёт этого преподавателя: адресованные ему, а куратора — ещё и оставшиеся без адресата */
export async function pendingWorkCount(groupId: string, teacherId: string) {
  const curatorId = await curatorOf(groupId);
  const to = teacherId === curatorId ? { OR: [{ recipientId: teacherId }, { recipientId: null }] } : { recipientId: teacherId };
  return prisma.studentWork.count({ where: { student: { groupId }, status: 'PENDING', ...PORTFOLIO, ...to } });
}

/** Решения, которых ученик ещё не видел: для счётчика в шапке */
export const unseenWorks = (studentId: string) =>
  prisma.studentWork.count({ where: { studentId, decidedAt: { not: null }, seenAt: null, ...PORTFOLIO } });

/**
 * Решение любого преподавателя группы. Его можно поменять: снять с публикации или опубликовать
 * после доработки. Новое решение снова считается для ученика новым.
 */
export async function decideWork(
  groupId: string,
  teacher: { id: string; accountId: string },
  id: string,
  decision: { status: 'APPROVED' | 'RETURNED'; comment: string },
) {
  const { count } = await prisma.studentWork.updateMany({
    where: { id, student: { groupId }, ...PORTFOLIO },
    data: { ...decision, decidedAt: new Date(), decidedById: teacher.accountId, seenAt: null },
  });
  if (!count) throw notFound('Работа не найдена');
  return groupWorks(groupId, teacher.id);
}

export async function deleteWork(teacherId: string, id: string) {
  const work = await prisma.studentWork.findFirst({
    where: { id, student: { group: groupsOf(teacherId) }, ...PORTFOLIO },
    select: { student: true },
  });
  if (!work) throw notFound('Работа не найдена');
  await prisma.studentWork.delete({ where: { id } });
  await purgeDeletedFiles();
  return groupWorks(work.student.groupId, teacherId);
}
