import type { Assignment, AssignmentDetail, TeacherAssignment } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client.js';
import { dateKey, dbDate, dbDateKey } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { lockGroup } from '../access/index.js';
import { addFileRows, fileView, prepareUpload, purgeDeletedFiles, writeUploads, type Upload } from '../files/index.js';
import { findWorks } from '../works/index.js';
import type { AssignmentInput } from './schemas.js';

/**
 * Задания группе от её преподавателей: текст, фото или PDF, срок и баллы за принятый ответ. Кому выдано,
 * запоминается списком учеников: пришедший позже ученик старых заданий не получает.
 */
export const MAX_ASSIGNMENT_FILES = 5;

export const ASSIGNMENT_INCLUDE = {
  files: { orderBy: { position: 'asc' } },
  createdBy: { select: { teacher: { select: { name: true } } } },
} as const satisfies Prisma.AssignmentInclude;

type Loaded = Prisma.AssignmentGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;

export function assignmentView(a: Loaded): Assignment {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    dueOn: a.dueOn ? dbDateKey(a.dueOn) : null,
    points: a.points,
    createdAt: a.createdAt.toISOString(),
    author: a.createdBy?.teacher?.name ?? null,
    files: a.files.map(fileView),
  };
}

/** Сдан позже срока: день сдачи по времени школы после дня срока */
export const isLate = (dueOn: string | null, submittedAt: Date) => !!dueOn && dateKey(submittedAt) > dueOn;

/** Кому выдать: всей группе, команде или выбранным ученикам этой группы */
async function receivers(groupId: string, input: AssignmentInput) {
  const where: Prisma.StudentWhereInput = { groupId };
  if (input.target === 'team') {
    if (!(await prisma.team.findFirst({ where: { id: input.teamId, groupId } }))) throw notFound('Команда не найдена');
    where.teamId = input.teamId;
  }
  if (input.target === 'students') where.id = { in: input.studentIds };
  const students = await prisma.student.findMany({ where, select: { id: true } });
  if (input.target === 'students' && students.length !== new Set(input.studentIds).size) throw notFound('Ученик не найден в группе');
  if (!students.length) throw new HttpError(400, 'Некому выдать задание: в выбранной части группы нет учеников');
  return students.map((s) => s.id);
}

/** Задание с файлами создаётся целиком или никак, как запись ленты */
export async function createAssignment(groupId: string, accountId: string, input: AssignmentInput, files: File[]) {
  if (files.length > MAX_ASSIGNMENT_FILES) throw new HttpError(400, `К заданию можно приложить не больше ${MAX_ASSIGNMENT_FILES} файлов`);
  const studentIds = await receivers(groupId, input);
  const uploads: Upload[] = [];
  for (const file of files) uploads.push(await prepareUpload(file));
  const { created, rows } = await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const created = await tx.assignment.create({
      data: {
        groupId,
        title: input.title,
        description: input.description,
        dueOn: input.dueOn ? dbDate(input.dueOn) : null,
        points: input.points,
        createdById: accountId,
        students: { createMany: { data: studentIds.map((studentId) => ({ studentId })) } },
      },
    });
    return { created, rows: await addFileRows(tx, groupId, { groupId }, accountId, uploads, { assignmentId: created.id }) };
  });
  try {
    await writeUploads(rows, uploads);
  } catch (err) {
    await prisma.assignment.delete({ where: { id: created.id } });
    await purgeDeletedFiles();
    throw err;
  }
  return groupAssignments(groupId);
}

const WITH_COUNTS = {
  ...ASSIGNMENT_INCLUDE,
  students: { include: { student: { select: { id: true, name: true } } } },
  works: { select: { studentId: true, status: true, createdAt: true } },
} as const satisfies Prisma.AssignmentInclude;

/** Сводка по ответам: считается последний ответ каждого ученика */
function withCounts(a: Prisma.AssignmentGetPayload<{ include: typeof WITH_COUNTS }>): TeacherAssignment {
  const latest = new Map<string, string>();
  for (const w of [...a.works].sort((x, y) => +x.createdAt - +y.createdAt)) latest.set(w.studentId, w.status);
  const count = (status: string) => [...latest.values()].filter((s) => s === status).length;
  return {
    ...assignmentView(a),
    assigned: a.students.length,
    pending: count('PENDING'),
    accepted: count('APPROVED'),
    returned: count('RETURNED'),
  };
}

/** Задания группы, новые сверху */
export async function groupAssignments(groupId: string): Promise<TeacherAssignment[]> {
  const list = await prisma.assignment.findMany({ where: { groupId }, orderBy: { createdAt: 'desc' }, include: WITH_COUNTS });
  return list.map(withCounts);
}

/** Задание с ответами каждого получившего его ученика, по алфавиту */
export async function assignmentDetail(groupId: string, id: string): Promise<AssignmentDetail> {
  const a = await prisma.assignment.findFirst({ where: { id, groupId }, include: WITH_COUNTS });
  if (!a) throw notFound('Задание не найдено');
  const summary = withCounts(a);
  const works = await findWorks({ assignmentId: id });
  const answers = a.students
    .map(({ student }) => {
      const found = works.find((w) => w.studentId === student.id);
      const work = found ? (({ studentId: _, assignmentId: __, ...rest }) => rest)(found) : null;
      return {
        student,
        status: work?.status ?? ('NONE' as const),
        work,
        late: !!work && isLate(summary.dueOn, new Date(work.createdAt)),
      };
    })
    .sort((x, y) => x.student.name.localeCompare(y.student.name, 'ru'));
  return { ...summary, answers };
}

/** Удаление уносит ответы и файлы; уже выданные баллы остаются у учеников */
export async function deleteAssignment(groupId: string, id: string) {
  const { count } = await prisma.assignment.deleteMany({ where: { id, groupId } });
  if (!count) throw notFound('Задание не найдено');
  await purgeDeletedFiles();
  return groupAssignments(groupId);
}

export const pendingAnswerCount = (groupId: string) =>
  prisma.studentWork.count({ where: { assignment: { groupId }, status: 'PENDING' } });
