import { prisma } from '../db.js';
import { studentHasPremium } from './premium.js';
import { studentLevel } from './points.js';

/**
 * «Новости» ученика: поздравление с новым уровнем и детали, открывшиеся с тех пор,
 * как он последний раз заходил в конструктор. Уровень всегда считается на сервере.
 */
export async function studentNews(studentId: string) {
  const [student, level, premium] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { celebratedLevel: true, partsSeenLevel: true },
    }),
    studentLevel(studentId),
    studentHasPremium(studentId),
  ]);
  const newParts =
    level.level > student.partsSeenLevel
      ? await prisma.heroPart.findMany({
          where: {
            active: true,
            // Премиум-детали в новостях — только если премиум открыт
            ...(premium ? {} : { isPremium: false }),
            requiredLevel: { gt: student.partsSeenLevel, lte: level.level },
          },
          orderBy: [{ requiredLevel: 'asc' }, { sortOrder: 'asc' }],
          select: { id: true },
        })
      : [];
  return {
    level: level.level,
    title: level.title,
    levelUp: level.level > student.celebratedLevel ? { from: student.celebratedLevel, to: level.level } : null,
    newPartIds: newParts.map((p) => p.id),
  };
}

export type StudentNews = Awaited<ReturnType<typeof studentNews>>;

/** Отмечает поздравление или новые детали просмотренными (до текущего уровня) */
export async function markNewsSeen(studentId: string, kind: 'level' | 'parts') {
  const { level } = await studentLevel(studentId);
  const field = kind === 'level' ? 'celebratedLevel' : 'partsSeenLevel';
  // Только вперёд: если баллы отменили и уровень упал, отметка не откатывается
  await prisma.student.updateMany({
    where: { id: studentId, [field]: { lt: level } },
    data: { [field]: level },
  });
  return studentNews(studentId);
}
