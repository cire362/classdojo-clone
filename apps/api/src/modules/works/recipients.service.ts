import type { WorkAddress, WorkRecipient } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { HttpError } from '../../platform/errors.js';
import { groupSubjects } from '../subjects/index.js';

/**
 * Кому студент сдаёт работу: любому преподавателю группы — куратору (создателю группы), преподавателю дисциплины
 * или соавтору без дисциплины. Работу видят все преподаватели группы, но ждёт её адресат: у него она в очереди
 * «На проверке» и в счётчике.
 */
export async function workRecipients(groupId: string): Promise<WorkRecipient[]> {
  const [group, subjects] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: {
        teacher: { select: { id: true, name: true } },
        coTeachers: { orderBy: { teacher: { name: 'asc' } }, select: { teacher: { select: { id: true, name: true } } } },
      },
    }),
    groupSubjects(groupId),
  ]);
  const curatorId = group.teacher.id;
  const option = (t: { id: string; name: string }, s: { id: string; name: string } | null): WorkRecipient => ({
    teacherId: t.id, teacher: t.name, subjectId: s?.id ?? null, subject: s?.name ?? null, curator: t.id === curatorId,
  });
  const withSubject = new Set(subjects.map((s) => s.teacher.id));
  return [
    option(group.teacher, null),
    ...subjects.map((s) => option(s.teacher, s.subject)),
    ...group.coTeachers.filter((c) => c.teacher.id !== curatorId && !withSubject.has(c.teacher.id)).map((c) => option(c.teacher, null)),
  ];
}

export const groupOfStudent = async (studentId: string) =>
  (await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } })).groupId;

export const studentRecipients = async (studentId: string) => workRecipients(await groupOfStudent(studentId));

/** Адресат новой работы: выбранная пара из списка группы; без выбора — куратор */
export async function pickRecipient(groupId: string, to: { teacherId?: string | null; subjectId?: string | null }) {
  const options = await workRecipients(groupId);
  if (!to.teacherId && !to.subjectId) return options[0];
  const found = options.find((o) => (!to.teacherId || o.teacherId === to.teacherId) && o.subjectId === (to.subjectId || null));
  if (!found) throw new HttpError(404, 'Этот преподаватель не ведёт вашу группу');
  return found;
}

/** Адрес сохранённой работы; curatorId — создатель группы */
export function addressOf(
  w: { recipient: { id: string; name: string } | null; subject: { name: string } | null },
  curatorId: string,
): WorkAddress {
  return {
    teacherId: w.recipient?.id ?? null,
    teacher: w.recipient?.name ?? null,
    subject: w.subject?.name ?? null,
    curator: w.recipient?.id === curatorId,
  };
}
