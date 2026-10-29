import { prisma } from '../db.js';
import { env } from '../env.js';

/**
 * Премиум. Подключается преподавателю (поле premiumUntil) и действует на группы, которые он создал:
 * их ученикам открывается премиум-коллекция деталей героя. Платежей пока нет — срок ставит
 * администратор командой set-premium.
 */
/** Пока действует «премиум бесплатно для всех» (env.premiumForAll), премиум активен у всех */
export const isActive = (until: Date | null | undefined) => env.premiumForAll || (!!until && until > new Date());

export async function teacherPremium(teacherId: string) {
  const t = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId }, select: { premiumUntil: true } });
  return { active: isActive(t.premiumUntil), until: t.premiumUntil, freeForAll: env.premiumForAll };
}

/** Премиум ученика — по создателю его группы */
export async function studentHasPremium(studentId: string): Promise<boolean> {
  const s = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { group: { select: { teacher: { select: { premiumUntil: true } } } } },
  });
  return isActive(s.group.teacher.premiumUntil);
}
