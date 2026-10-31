import type { FeedPost } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { groupsOf } from '../../services/access.js';

/** Лента класса: объявления преподавателей группы для учеников и их родителей */
export const MAX_POST_LENGTH = 2000;
const PAGE = 100;

type Viewer = { accountId: string; teacherId?: string | null; isOwner?: boolean };

/** Лента текущей группы ученика: для него самого и для родителя */
export async function studentFeed(studentId: string, accountId: string): Promise<FeedPost[]> {
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } });
  return groupFeed(s.groupId, { accountId });
}

export async function groupFeed(groupId: string, viewer: Viewer): Promise<FeedPost[]> {
  const through = new Date();
  const posts = await prisma.post.findMany({
    where: { groupId, createdAt: { lte: through } },
    orderBy: { createdAt: 'desc' },
    take: PAGE,
    include: { author: { select: { id: true, name: true } } },
  });
  // События, появившиеся во время загрузки, останутся новыми; старый запрос не откатит отметку.
  await markFeedRead(viewer.accountId, groupId, through);
  return posts.map((p) => ({
    id: p.id,
    text: p.text,
    createdAt: p.createdAt.toISOString(),
    author: p.author.name,
    // Удалить запись может её автор и создатель группы
    canDelete: !!viewer.teacherId && (p.author.id === viewer.teacherId || !!viewer.isOwner),
  }));
}

export async function markFeedRead(
  accountId: string,
  groupId: string,
  through: Date,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await db.$executeRaw`
    INSERT INTO "FeedRead" ("accountId", "groupId", "readAt") VALUES (${accountId}, ${groupId}, ${through})
    ON CONFLICT ("accountId", "groupId") DO UPDATE
    SET "readAt" = GREATEST("FeedRead"."readAt", EXCLUDED."readAt")
  `;
}

export async function createPost(groupId: string, authorId: string, text: string): Promise<FeedPost> {
  const p = await prisma.post.create({ data: { groupId, authorId, text }, include: { author: { select: { name: true } } } });
  return { id: p.id, text: p.text, createdAt: p.createdAt.toISOString(), author: p.author.name, canDelete: true };
}

export async function deletePost(teacherId: string, postId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, group: groupsOf(teacherId) }, include: { group: true } });
  if (!post) throw notFound('Запись не найдена');
  if (post.authorId !== teacherId && post.group.teacherId !== teacherId) {
    throw new HttpError(403, 'Удалить запись может её автор или создатель группы');
  }
  await prisma.post.delete({ where: { id: post.id } });
}

/** Сколько новых записей в лентах групп с момента последнего просмотра */
export async function unreadPosts(accountId: string, groupIds: string[]): Promise<number> {
  if (!groupIds.length) return 0;
  const reads = await prisma.feedRead.findMany({ where: { accountId, groupId: { in: groupIds } } });
  const readAt = new Map(reads.map((r) => [r.groupId, r.readAt]));
  const counts = await Promise.all(
    groupIds.map((groupId) =>
      prisma.post.count({ where: { groupId, ...(readAt.has(groupId) ? { createdAt: { gt: readAt.get(groupId)! } } : {}) } }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
}
