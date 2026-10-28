import { prisma } from '../db.js';
import { dateKey, dbDate, dbDateKey, localDayStart } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';
import { attendanceReason } from './reasons.js';

/** Отметка группы за день или null, если в этот день не отмечали */
export async function attendanceForDate(groupId: string, date: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { groupId_date: { groupId, date: dbDate(date) } },
    include: { records: { select: { studentId: true, present: true } } },
  });
  return {
    date,
    session: session && {
      peopleOnPhoto: session.peopleOnPhoto,
      subtractedTeacher: session.subtractedTeacher,
      presentStudentIds: session.records.filter((r) => r.present).map((r) => r.studentId),
      markedStudentIds: session.records.map((r) => r.studentId),
    },
  };
}

/**
 * Сохраняет посещаемость группы за день. Повторное сохранение за тот же день
 * перезаписывает отметку, а баллы «Посещение» пересоздаются — двойного начисления нет.
 */
export async function saveAttendance(params: {
  groupId: string;
  date: string;
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
  const pointsAt = params.date === dateKey() ? new Date() : new Date(localDayStart(params.date).getTime() + 12 * 3600_000);

  return prisma.$transaction(async (tx) => {
    const reason = await attendanceReason(tx, params.groupId);
    const date = dbDate(params.date);
    const session = await tx.attendanceSession.upsert({
      where: { groupId_date: { groupId: params.groupId, date } },
      create: {
        groupId: params.groupId,
        date,
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
        createdAt: pointsAt,
      })),
    });
    return {
      id: session.id,
      date: dbDateKey(session.date),
      presentCount: present.size,
      studentsTotal: students.length,
    };
  });
}
