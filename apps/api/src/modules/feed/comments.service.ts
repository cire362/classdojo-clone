import type { FeedPost } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { logAction, type Actor } from '../moderation/index.js';
import { feedPost, openPost, type Viewer } from './service.js';

/** «Маша Иванова» → «Маша И.»: подпись родителя видят другие родители группы */
const shortName = (name: string) => {
  const [first, last] = name.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

export async function parentLabel(studentId: string) {
  const { name } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { name: true } });
  return `Родитель: ${shortName(name)}`;
}

export async function addComment(groupId: string, postId: string, viewer: Viewer, authorName: string, text: string): Promise<FeedPost> {
  const post = await openPost(groupId, postId);
  if (!post.group.feedComments) throw new HttpError(409, 'Преподаватель отключил комментарии в этой группе');
  await prisma.postComment.create({ data: { postId, accountId: viewer.accountId, authorName, text } });
  return feedPost(groupId, postId, viewer);
}

/**
 * Преподаватель группы удаляет любой комментарий, родитель только свой и только видимый; отключение комментариев
 * этому не мешает. Удаление преподавателем попадает в журнал модерации.
 */
export async function deleteComment(groupId: string, postId: string, commentId: string, viewer: Viewer, actor: Actor): Promise<FeedPost> {
  const isTeacher = viewer.role === 'teacher';
  const where = { id: commentId, post: { id: postId, groupId }, ...(isTeacher ? {} : { accountId: viewer.accountId, hiddenAt: null }) };
  await prisma.$transaction(async (tx) => {
    const comment = await tx.postComment.findFirst({ where });
    if (!comment) throw notFound('Комментарий не найден');
    await tx.postComment.delete({ where: { id: comment.id } });
    if (isTeacher) await logAction(tx, groupId, actor, 'delete', 'comment', comment);
  });
  return feedPost(groupId, postId, viewer);
}
