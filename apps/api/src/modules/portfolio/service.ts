import type { PortfolioItem } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { notFound } from '../../platform/errors.js';
import { groupsOf } from '../../services/access.js';

export async function portfolioItems(studentId: string): Promise<PortfolioItem[]> {
  const items = await prisma.portfolioItem.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, description: true, emoji: true, createdAt: true,
      createdBy: { select: { teacher: { select: { name: true } } } },
    },
  });
  return items.map(({ createdBy, ...p }) => ({ ...p, createdAt: p.createdAt.toISOString(), author: createdBy.teacher?.name ?? '' }));
}

export async function addPortfolioItem(
  studentId: string,
  accountId: string,
  data: { title: string; description: string; emoji: string },
): Promise<PortfolioItem[]> {
  await prisma.portfolioItem.create({ data: { ...data, studentId, createdById: accountId } });
  return portfolioItems(studentId);
}

/** Удалить запись может преподаватель группы ученика: чужая запись — как несуществующая */
export async function deletePortfolioItem(teacherId: string, id: string): Promise<PortfolioItem[]> {
  const item = await prisma.portfolioItem.findFirst({ where: { id, student: { group: groupsOf(teacherId) } } });
  if (!item) throw notFound('Запись не найдена');
  await prisma.portfolioItem.delete({ where: { id: item.id } });
  return portfolioItems(item.studentId);
}
