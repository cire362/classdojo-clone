import type { Notifications } from '@heroes/shared/api';
import type { AuthUser } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { groupsOf } from '../access/index.js';
import { unreadPosts } from '../feed/index.js';
import { isQuietNow, unreadMessages } from '../messages/index.js';
import { pendingRequestsOf, unreadRewards } from '../rewards/index.js';

/** Значки в шапке: сообщения, лента, выданные награды ученика или ожидающие запросы преподавателя. */
export async function notifications(user: AuthUser): Promise<Notifications> {
  if (user.teacherId) {
    const threads = await prisma.message.groupBy({
      by: ['studentId', 'parentId'],
      where: { student: { group: groupsOf(user.teacherId) } },
    });
    // Ветки отвязанных родителей не показываются — и не считаются
    const links = threads.length
      ? await prisma.parentStudent.findMany({ where: { OR: threads.map((t) => ({ studentId: t.studentId, parentId: t.parentId })) } })
      : [];
    const [quiet, unread, rewards] = await Promise.all([
      isQuietNow(user.teacherId),
      unreadMessages(user.accountId, links),
      prisma.rewardRequest.count({ where: pendingRequestsOf(user.teacherId) }),
    ]);
    return { messages: quiet ? 0 : unread, feed: 0, rewards };
  }
  if (user.studentId) {
    const s = await prisma.student.findUniqueOrThrow({ where: { id: user.studentId }, select: { groupId: true, rewardsReadAt: true } });
    const [feed, rewards] = await Promise.all([unreadPosts(user.accountId, [s.groupId]), unreadRewards(user.studentId, s.rewardsReadAt)]);
    return { messages: 0, feed, rewards };
  }
  if (user.parentId) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: user.parentId },
      select: { studentId: true, student: { select: { groupId: true } } },
    });
    const [messages, feed] = await Promise.all([
      unreadMessages(user.accountId, links.map((l) => ({ studentId: l.studentId, parentId: user.parentId! }))),
      unreadPosts(user.accountId, [...new Set(links.map((l) => l.student.groupId))]),
    ]);
    return { messages, feed, rewards: 0 };
  }
  return { messages: 0, feed: 0, rewards: 0 };
}
