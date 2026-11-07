import { prisma } from '../../platform/db.js';

/**
 * Ветка переписки: «родитель + ученик» или ветка самого студента с преподавателями группы (parentId = null,
 * только в колледже и вузе). Прочтение веток студента хранится отдельно: у них нет родителя для ключа ThreadRead.
 */
export type ThreadKey = { studentId: string; parentId: string | null };

export const threadKey = (t: ThreadKey) => `${t.studentId}|${t.parentId ?? ''}`;

/** Когда аккаунт последний раз открывал каждую ветку */
export async function readTimes(accountId: string): Promise<Map<string, Date>> {
  const [parents, students] = await Promise.all([
    prisma.threadRead.findMany({ where: { accountId } }),
    prisma.studentThreadRead.findMany({ where: { accountId } }),
  ]);
  return new Map([
    ...parents.map((r): [string, Date] => [threadKey(r), r.readAt]),
    ...students.map((r): [string, Date] => [threadKey({ studentId: r.studentId, parentId: null }), r.readAt]),
  ]);
}

export async function markRead(accountId: string, { studentId, parentId }: ThreadKey, readAt: Date) {
  if (parentId) {
    await prisma.threadRead.upsert({
      where: { accountId_studentId_parentId: { accountId, studentId, parentId } },
      create: { accountId, studentId, parentId, readAt },
      update: { readAt },
    });
  } else {
    await prisma.studentThreadRead.upsert({
      where: { accountId_studentId: { accountId, studentId } },
      create: { accountId, studentId, readAt },
      update: { readAt },
    });
  }
}

/** Новые сообщения в ветке от других участников после последнего просмотра */
export function unreadIn(t: ThreadKey, accountId: string, readAt: Date | undefined, now: Date) {
  return prisma.message.count({
    where: {
      studentId: t.studentId,
      parentId: t.parentId,
      senderId: { not: accountId },
      createdAt: { lte: now, ...(readAt ? { gt: readAt } : {}) },
    },
  });
}

/** Непрочитанные сообщения в ветках (для счётчика) */
export async function unreadMessages(accountId: string, threads: ThreadKey[]): Promise<number> {
  if (!threads.length) return 0;
  const reads = await readTimes(accountId);
  const now = new Date();
  const counts = await Promise.all(threads.map((t) => unreadIn(t, accountId, reads.get(threadKey(t)), now)));
  return counts.reduce((a, b) => a + b, 0);
}
