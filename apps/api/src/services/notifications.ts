import type { AuthUser } from '../platform/auth.js';
import { prisma } from '../platform/db.js';
import { groupsOf } from '../modules/access/index.js';
import { unreadPosts } from '../modules/feed/index.js';
import { unreadMessages } from '../modules/messages/index.js';
import { pendingRequestsOf, unreadRewards } from '../modules/rewards/index.js';

/** Значки в шапке: сообщения, лента, выданные награды ученика или ожидающие запросы преподавателя. */
export async function notifications(user: AuthUser) {
  if (user.teacherId) {
    const threads = await prisma.message.groupBy({ by: ['studentId', 'parentId'], where: { student: { group: groupsOf(user.teacherId) } } });
    // Ветки отвязанных родителей не показываются — и не считаются
    const links = threads.length
      ? await prisma.parentStudent.findMany({ where: { OR: threads.map((t) => ({ studentId: t.studentId, parentId: t.parentId })) } })
      : [];
    const [messages, rewards] = await Promise.all([
      unreadMessages(user.accountId, links),
      prisma.rewardRequest.count({ where: pendingRequestsOf(user.teacherId) }),
    ]);
    return { messages, feed: 0, rewards };
  }
  if (user.studentId) {
    const s = await prisma.student.findUniqueOrThrow({ where: { id: user.studentId }, select: { groupId: true, rewardsReadAt: true } });
    const [feed, rewards] = await Promise.all([unreadPosts(user.accountId, [s.groupId]), unreadRewards(user.studentId, s.rewardsReadAt)]);
    return { messages: 0, feed, rewards };
  }
  if (user.parentId) {
    const links = await prisma.parentStudent.findMany({ where: { parentId: user.parentId }, select: { studentId: true, student: { select: { groupId: true } } } });
    const [messages, feed] = await Promise.all([
      unreadMessages(user.accountId, links.map((l) => ({ studentId: l.studentId, parentId: user.parentId! }))),
      unreadPosts(user.accountId, [...new Set(links.map((l) => l.student.groupId))]),
    ]);
    return { messages, feed, rewards: 0 };
  }
  return { messages: 0, feed: 0, rewards: 0 };
}
