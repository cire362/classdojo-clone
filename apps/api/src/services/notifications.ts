import type { AuthUser } from '../auth.js';
import { prisma } from '../db.js';
import { groupsOf } from './access.js';
import { unreadPosts } from './feed.js';
import { unreadMessages } from './messages.js';

/** Счётчики для значков в шапке: новые сообщения и новые записи в ленте */
export async function notifications(user: AuthUser) {
  if (user.teacherId) {
    const threads = await prisma.message.groupBy({ by: ['studentId', 'parentId'], where: { student: { group: groupsOf(user.teacherId) } } });
    // Ветки отвязанных родителей не показываются — и не считаются
    const links = threads.length
      ? await prisma.parentStudent.findMany({ where: { OR: threads.map((t) => ({ studentId: t.studentId, parentId: t.parentId })) } })
      : [];
    return { messages: await unreadMessages(user.accountId, links), feed: 0 };
  }
  if (user.studentId) {
    const s = await prisma.student.findUniqueOrThrow({ where: { id: user.studentId }, select: { groupId: true } });
    return { messages: 0, feed: await unreadPosts(user.accountId, [s.groupId]) };
  }
  if (user.parentId) {
    const links = await prisma.parentStudent.findMany({ where: { parentId: user.parentId }, select: { studentId: true, student: { select: { groupId: true } } } });
    const [messages, feed] = await Promise.all([
      unreadMessages(user.accountId, links.map((l) => ({ studentId: l.studentId, parentId: user.parentId! }))),
      unreadPosts(user.accountId, [...new Set(links.map((l) => l.student.groupId))]),
    ]);
    return { messages, feed };
  }
  return { messages: 0, feed: 0 };
}
