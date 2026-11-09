import type { WorkAddress, WorkRecipients } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { groupSubjects } from '../subjects/index.js';

/**
 * Кому студент сдаёт работу: куратору группы (её создателю) или преподавателю дисциплины группы.
 * Работу по-прежнему видят все преподаватели группы, адрес говорит, кто её ждёт.
 */
export async function workRecipients(groupId: string): Promise<WorkRecipients> {
  const [group, subjects] = await Promise.all([
    prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { teacher: { select: { name: true } } } }),
    groupSubjects(groupId),
  ]);
  return {
    curator: group.teacher.name,
    subjects: subjects.map((s) => ({ id: s.subject.id, name: s.subject.name, teacher: s.teacher.name })),
  };
}

export const studentRecipients = async (studentId: string) =>
  workRecipients((await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } })).groupId);

/** Адрес работы по нынешнему составу группы: преподаватель дисциплины мог смениться */
export function addressOf(subject: { id: string; name: string } | null, recipients: WorkRecipients): WorkAddress {
  if (!subject) return { subject: null, teacher: recipients.curator };
  return { subject: subject.name, teacher: recipients.subjects.find((s) => s.id === subject.id)?.teacher ?? null };
}
