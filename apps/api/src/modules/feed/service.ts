import { REACTION_KINDS, type ReactionKind } from '@heroes/shared';
import type { FeedPost } from '@heroes/shared/api';
import { scheduledAt } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { ARCHIVED_MESSAGE, groupsOf } from '../access/index.js';

/** Лента класса: объявления преподавателей группы для учеников и их родителей */
export const MAX_POST_LENGTH = 2000;
const PAGE = 100;
const MAX_PINNED = 3;
const COMMENTS_SHOWN = 50;

export type Viewer = { accountId: string; role: 'teacher' | 'student' | 'parent'; teacherId?: string | null; isOwner?: boolean };

/** Лента текущей группы ученика: для него самого и для родителя */
export async function studentGroup(studentId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } });
  return s.groupId;
}

const POST_INCLUDE = {
  author: { select: { id: true, name: true } },
  reactions: { select: { accountId: true, kind: true } },
  // Новые важнее: показываем последние, но по порядку написания
  comments: { orderBy: { createdAt: 'desc' }, take: COMMENTS_SHOWN },
  group: { select: { feedComments: true, archivedAt: true } },
} as const;

type LoadedPost = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

function postView(p: LoadedPost, viewer: Viewer, now: Date): FeedPost {
  const reactions = Object.fromEntries(REACTION_KINDS.map((k) => [k, p.reactions.filter((r) => r.kind === k).length]));
  const isTeacher = viewer.role === 'teacher';
  const open = !p.group.archivedAt && p.createdAt <= now;
  return {
    id: p.id,
    text: p.text,
    createdAt: p.createdAt.toISOString(),
    author: p.author.name,
    // Удалить запись может её автор и создатель группы
    canDelete: isTeacher && (p.author.id === viewer.teacherId || !!viewer.isOwner),
    pinned: p.pinned,
    scheduled: p.createdAt > now,
    reactions: reactions as FeedPost['reactions'],
    myReaction: (p.reactions.find((r) => r.accountId === viewer.accountId)?.kind ?? null) as ReactionKind | null,
    // Комментарии — разговор взрослых, ученики их не видят
    comments: viewer.role === 'student' ? [] : [...p.comments].reverse().map((c) => ({
      id: c.id,
      author: c.authorName,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      canDelete: isTeacher || c.accountId === viewer.accountId,
    })),
    canComment: viewer.role !== 'student' && p.group.feedComments && open,
    canReact: open,
    canPin: isTeacher && !p.group.archivedAt,
  };
}

export async function groupFeed(groupId: string, viewer: Viewer): Promise<FeedPost[]> {
  const through = new Date();
  const posts = await prisma.post.findMany({
    where: { groupId, ...(viewer.role === 'teacher' ? {} : { createdAt: { lte: through } }) },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: PAGE,
    include: POST_INCLUDE,
  });
  // События, появившиеся во время загрузки, останутся новыми; старый запрос не откатит отметку.
  await markFeedRead(viewer.accountId, groupId, through);
  return posts.map((p) => postView(p, viewer, through));
}

/** Запись после изменения, глазами того, кто её изменил */
export async function feedPost(groupId: string, postId: string, viewer: Viewer): Promise<FeedPost> {
  const post = await prisma.post.findFirst({ where: { id: postId, groupId }, include: POST_INCLUDE });
  if (!post) throw notFound('Запись не найдена');
  return postView(post, viewer, new Date());
}

/** Опубликованная запись группы, которую ещё можно менять: отложенной для учеников и родителей нет */
export async function openPost(groupId: string, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, groupId, createdAt: { lte: new Date() } },
    select: { id: true, group: { select: { feedComments: true, archivedAt: true } } },
  });
  if (!post) throw notFound('Запись не найдена');
  if (post.group.archivedAt) throw new HttpError(409, ARCHIVED_MESSAGE);
  return post;
}

export async function setReaction(groupId: string, postId: string, viewer: Viewer, kind: ReactionKind | null) {
  await openPost(groupId, postId);
  const key = { postId_accountId: { postId, accountId: viewer.accountId } };
  if (kind) await prisma.postReaction.upsert({ where: key, create: { postId, accountId: viewer.accountId, kind }, update: { kind } });
  else await prisma.postReaction.deleteMany({ where: { postId, accountId: viewer.accountId } });
  return feedPost(groupId, postId, viewer);
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

export async function createPost(groupId: string, viewer: Viewer, text: string, publishAt?: string): Promise<FeedPost> {
  const at = publishAt ? scheduledAt(publishAt) : undefined;
  const post = await prisma.post.create({ data: { groupId, authorId: viewer.teacherId!, text, ...(at ? { createdAt: at } : {}) } });
  return feedPost(groupId, post.id, viewer);
}

/** Закрепить запись может любой преподаватель группы. Лимит проверяется в транзакции с блокировкой группы */
export async function setPinned(groupId: string, postId: string, viewer: Viewer, pinned: boolean) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
    const post = await tx.post.findFirst({ where: { id: postId, groupId }, select: { pinned: true } });
    if (!post) throw notFound('Запись не найдена');
    if (pinned && !post.pinned && (await tx.post.count({ where: { groupId, pinned: true } })) >= MAX_PINNED) {
      throw new HttpError(400, `Закрепить можно не больше ${MAX_PINNED} записей. Сначала открепите другую`);
    }
    await tx.post.update({ where: { id: postId }, data: { pinned } });
  });
  return feedPost(groupId, postId, viewer);
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
  const now = new Date();
  const counts = await Promise.all(
    groupIds.map((groupId) =>
      prisma.post.count({ where: { groupId, createdAt: { lte: now, ...(readAt.has(groupId) ? { gt: readAt.get(groupId)! } : {}) } } }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
}
