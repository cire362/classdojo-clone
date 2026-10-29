import { lockGoalGroup } from './classGoals.js';
import { prisma } from '../db.js';
import { dateKey, dbDate, dbDateKey, localDayStart } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';
import { attendanceReason } from './reasons.js';

export const MAX_LESSONS_PER_DAY = 8;

/**
 * Отметки группы за день: список уже отмеченных уроков и подробности по выбранному.
 * Если урок не указан, берётся последний отмеченный (или первый, если отметок нет).
 */
export async function attendanceForDate(groupId: string, date: string, lesson?: number) {
  const sessions = await prisma.attendanceSession.findMany({
    where: { groupId, date: dbDate(date) },
    orderBy: { lessonNumber: 'asc' },
    include: { records: { select: { studentId: true, present: true } } },
  });
  const chosen = lesson ?? sessions.at(-1)?.lessonNumber ?? 1;
  const session = sessions.find((s) => s.lessonNumber === chosen) ?? null;
  return {
    date,
    lesson: chosen,
    lessons: sessions.map((s) => ({
      lesson: s.lessonNumber,
      presentCount: s.records.filter((r) => r.present).length,
      studentsTotal: s.records.length,
      peopleOnPhoto: s.peopleOnPhoto,
    })),
    session: session && {
      peopleOnPhoto: session.peopleOnPhoto,
      subtractedTeacher: session.subtractedTeacher,
      presentStudentIds: session.records.filter((r) => r.present).map((r) => r.studentId),
      markedStudentIds: session.records.map((r) => r.studentId),
    },
  };
}

/** Удаляет отметку урока вместе с баллами «Посещение» за него */
export async function deleteAttendance(groupId: string, date: string, lesson: number) {
  const session = await prisma.attendanceSession.findUnique({
    where: { groupId_date_lessonNumber: { groupId, date: dbDate(date), lessonNumber: lesson } },
  });
  if (!session) throw new HttpError(404, 'Отметка не найдена');
  // Баллы и записи удаляются каскадом
  await prisma.attendanceSession.delete({ where: { id: session.id } });
}

/**
 * Сохраняет посещаемость группы за день. Повторное сохранение за тот же день
 * перезаписывает отметку, а баллы «Посещение» пересоздаются — двойного начисления нет.
 */
export async function saveAttendance(params: {
  groupId: string;
  date: string;
  lesson: number;
  presentStudentIds: string[];
  peopleOnPhoto: number | null;
  subtractedTeacher: boolean;
  createdById: string;
}) {
  const students = await prisma.student.findMany({ where: { groupId: params.groupId }, select: { id: true } });
  const groupIds = new Set(students.map((s) => s.id));
  const present = new Set(params.presentStudentIds);
  for (const id of present) {
    if (!groupIds.has(id)) throw new HttpError(404, 'Ученик не найден в группе');
  }

  // Баллы за урок в прошлом датируются днём урока (полдень), чтобы не попасть в «сегодня»
  // и в статистику не того периода
  const pointsAt =
    params.date === dateKey()
      ? new Date()
      : new Date(localDayStart(params.date).getTime() + (11 + params.lesson) * 3600_000);

  return prisma.$transaction(async (tx) => {
    await lockGoalGroup(tx, params.groupId);
    const goal = await tx.classGoal.findUnique({ where: { groupId: params.groupId }, select: { id: true } });
    const reason = await attendanceReason(tx, params.groupId);
    const date = dbDate(params.date);
    const session = await tx.attendanceSession.upsert({
      where: { groupId_date_lessonNumber: { groupId: params.groupId, date, lessonNumber: params.lesson } },
      create: {
        groupId: params.groupId,
        classGoalId: goal?.id ?? null,
        date,
        lessonNumber: params.lesson,
        peopleOnPhoto: params.peopleOnPhoto,
        subtractedTeacher: params.subtractedTeacher,
        studentsTotal: students.length,
        createdById: params.createdById,
      },
      update: {
        peopleOnPhoto: params.peopleOnPhoto,
        subtractedTeacher: params.subtractedTeacher,
        studentsTotal: students.length,
      },
    });
    await tx.attendance.deleteMany({ where: { sessionId: session.id } });
    await tx.pointEvent.deleteMany({ where: { attendanceSessionId: session.id } });
    await tx.attendance.createMany({
      data: students.map((s) => ({ sessionId: session.id, studentId: s.id, present: present.has(s.id) })),
    });
    await tx.pointEvent.createMany({
      data: [...present].map((studentId) => ({
        studentId,
        reasonId: reason.id,
        reasonName: reason.name,
        emoji: reason.emoji,
        value: reason.value,
        awardedById: params.createdById,
        attendanceSessionId: session.id,
        classGoalId: session.classGoalId,
        awardedGroupId: params.groupId,
        // Повторная отметка сегодняшнего урока не меняет время его вклада в уровень.
        createdAt: params.date === dateKey() ? session.createdAt : pointsAt,
      })),
    });
    return {
      id: session.id,
      date: dbDateKey(session.date),
      lesson: session.lessonNumber,
      presentCount: present.size,
      studentsTotal: students.length,
    };
  });
}
