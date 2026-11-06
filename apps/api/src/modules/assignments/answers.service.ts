import type { AnswerStatus, StudentAssignment } from '@heroes/shared/api';
import { dateKey } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { lockGroup } from '../access/index.js';
import { createWork, findWorks } from '../works/index.js';
import { ASSIGNMENT_INCLUDE, assignmentDetail, assignmentView } from './service.js';

/**
 * Ответы на задания: ученик сдаёт текст, фото, PDF или рисунок, преподаватель принимает или возвращает.
 * Баллы за принятый ответ начисляются один раз и снимаются, если ответ вернули.
 */

/** Задания ученика, новые сверху. Открытый список отмечает новые задания и решения увиденными */
export async function studentAssignments(studentId: string): Promise<StudentAssignment[]> {
  const links = await prisma.assignmentStudent.findMany({
    where: { studentId },
    orderBy: { assignment: { createdAt: 'desc' } },
    include: { assignment: { include: ASSIGNMENT_INCLUDE } },
  });
  const works = await findWorks({ studentId, assignmentId: { in: links.map((l) => l.assignmentId) } });
  const today = dateKey();
  const now = new Date();
  await Promise.all([
    prisma.assignmentStudent.updateMany({ where: { studentId, seenAt: null }, data: { seenAt: now } }),
    prisma.studentWork.updateMany({
      where: { studentId, assignmentId: { not: null }, decidedAt: { not: null }, seenAt: null },
      data: { seenAt: now },
    }),
  ]);
  return links.map(({ assignment, seenAt }) => {
    const view = assignmentView(assignment);
    const own = works.filter((w) => w.assignmentId === assignment.id);
    const status: AnswerStatus = own.length ? own[0].status : 'NONE';
    return {
      ...view,
      status,
      isNew: !seenAt,
      overdue: !!view.dueOn && today > view.dueOn && (status === 'NONE' || status === 'RETURNED'),
      works: own.map(({ studentId: _, assignmentId: __, ...w }) => w),
    };
  });
}

/** Новые задания и решения по ответам, которых ученик не видел: для значка */
export async function unseenAssignments(studentId: string) {
  const [fresh, decided] = await Promise.all([
    prisma.assignmentStudent.count({ where: { studentId, seenAt: null } }),
    prisma.studentWork.count({ where: { studentId, assignmentId: { not: null }, decidedAt: { not: null }, seenAt: null } }),
  ]);
  return fresh + decided;
}

/** Ответ получает название задания; сдать можно только выданное ученику задание */
export async function submitAnswer(studentId: string, accountId: string, assignmentId: string, answer: { text: string; files: File[] }) {
  const link = await prisma.assignmentStudent.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    include: { assignment: { select: { title: true } } },
  });
  if (!link) throw notFound('Задание не найдено');
  if (!answer.text && !answer.files.length) throw new HttpError(400, 'Напишите ответ или приложите фото, файл или рисунок');
  await createWork(studentId, accountId, { title: link.assignment.title, text: answer.text, files: answer.files }, assignmentId);
  return studentAssignments(studentId);
}

/**
 * Решение по ответу любым преподавателем группы. В архивной группе баллы заморожены, поэтому и решения тоже.
 * Принятый ответ получает баллы задания один раз; возврат снимает их, повторное принятие начислит снова.
 */
export async function decideAnswer(
  groupId: string,
  accountId: string,
  assignmentId: string,
  workId: string,
  decision: { status: 'APPROVED' | 'RETURNED'; comment: string },
) {
  await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const work = await tx.studentWork.findFirst({
      where: { id: workId, assignmentId, assignment: { groupId } },
      include: { assignment: { select: { title: true, points: true } } },
    });
    if (!work) throw notFound('Ответ не найден');
    let pointEventId = work.pointEventId;
    if (decision.status === 'APPROVED' && !pointEventId && work.assignment!.points > 0) {
      const goal = await tx.classGoal.findUnique({ where: { groupId }, select: { id: true } });
      const event = await tx.pointEvent.create({
        data: {
          studentId: work.studentId,
          reasonName: `Задание: ${work.assignment!.title}`,
          emoji: '📝',
          value: work.assignment!.points,
          awardedById: accountId,
          classGoalId: goal?.id ?? null,
          awardedGroupId: groupId,
        },
      });
      pointEventId = event.id;
    }
    if (decision.status === 'RETURNED' && pointEventId) {
      await tx.pointEvent.delete({ where: { id: pointEventId } });
      pointEventId = null;
    }
    await tx.studentWork.update({
      where: { id: work.id },
      data: { ...decision, decidedAt: new Date(), decidedById: accountId, seenAt: null, pointEventId },
    });
  });
  return assignmentDetail(groupId, assignmentId);
}
