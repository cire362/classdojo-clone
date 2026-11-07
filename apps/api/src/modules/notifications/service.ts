import type { Notifications } from '@heroes/shared/api';
import type { AuthUser } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { groupsOf } from '../access/index.js';
import { unreadPosts } from '../feed/index.js';
import { isQuietNow, unreadMessages } from '../messages/index.js';
import { pendingRequestsOf, unreadRewards } from '../rewards/index.js';
import { unseenWorks } from '../works/index.js';
import { unseenAssignments } from '../assignments/index.js';
import { unreadSchoolPosts } from '../schoolfeed/index.js';
import { unreadSchoolReplies, waitingThreads } from '../schoolinbox/index.js';

/** Значки в шапке: сообщения, лента, выданные награды и решения по работам ученика, ожидающие запросы преподавателя, лента школы. */
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
    const [quiet, unread, rewards, school] = await Promise.all([
      isQuietNow(user.teacherId),
      unreadMessages(user.accountId, links),
      prisma.rewardRequest.count({ where: pendingRequestsOf(user.teacherId) }),
      unreadSchoolPosts(user),
    ]);
    return { messages: quiet ? 0 : unread, feed: 0, rewards, works: 0, assignments: 0, school, schoolInbox: 0 };
  }
  if (user.studentId) {
    const s = await prisma.student.findUniqueOrThrow({ where: { id: user.studentId }, select: { groupId: true, rewardsReadAt: true } });
    // Лента и ящик учреждения есть только у студентов колледжа и вуза: schoolsOf вернёт для школьника пустой список
    const [feed, rewards, works, assignments, school, schoolInbox] = await Promise.all([
      unreadPosts(user.accountId, [s.groupId]),
      unreadRewards(user.studentId, s.rewardsReadAt),
      unseenWorks(user.studentId),
      unseenAssignments(user.studentId),
      unreadSchoolPosts(user),
      unreadSchoolReplies(user),
    ]);
    return { messages: 0, feed, rewards, works, assignments, school, schoolInbox };
  }
  if (user.parentId) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: user.parentId },
      select: { studentId: true, student: { select: { groupId: true } } },
    });
    const [messages, feed, school, schoolInbox] = await Promise.all([
      unreadMessages(user.accountId, links.map((l) => ({ studentId: l.studentId, parentId: user.parentId! }))),
      unreadPosts(user.accountId, [...new Set(links.map((l) => l.student.groupId))]),
      unreadSchoolPosts(user),
      unreadSchoolReplies(user),
    ]);
    return { messages, feed, rewards: 0, works: 0, assignments: 0, school, schoolInbox };
  }
  const none = { messages: 0, feed: 0, rewards: 0, works: 0, assignments: 0, school: 0 };
  // Администрации школы — переписки, ждущие ответа
  if (user.role === 'ADMIN') return { ...none, schoolInbox: await waitingThreads(user.schoolId!) };
  return { ...none, schoolInbox: 0 };
}
