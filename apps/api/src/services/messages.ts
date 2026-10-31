import { prisma } from '../platform/db.js';
import { notFound } from '../platform/errors.js';
import { groupsOf } from './access.js';

/**
 * Сообщения родителя и преподавателей группы о конкретном ребёнке. Ветка — пара (родитель, ученик):
 * её видят все преподаватели группы ученика и этот родитель. Ученики в переписке не участвуют.
 */
export const MAX_MESSAGE_LENGTH = 2000;

/** Ветка, доступная преподавателю: ученик в его группе, родитель привязан к ученику */
export async function teacherThread(teacherId: string, studentId: string, parentId: string) {
  const link = await prisma.parentStudent.findFirst({
    where: { studentId, parentId, student: { group: groupsOf(teacherId) } },
    include: { student: { select: { name: true, group: { select: { id: true, name: true, archivedAt: true } } } }, parent: { include: { account: { select: { login: true } } } } },
  });
  if (!link) throw notFound('Переписка не найдена');
  return { studentName: link.student.name, group: link.student.group, parentLogin: link.parent.account.login };
}

export async function threadMessages(studentId: string, parentId: string, accountId: string) {
  const messages = await prisma.message.findMany({
    where: { studentId, parentId },
    orderBy: { createdAt: 'asc' },
    take: 500,
    include: { sender: { include: { teacher: { select: { name: true } } } } },
  });
  const now = new Date();
  await prisma.threadRead.upsert({
    where: { accountId_studentId_parentId: { accountId, studentId, parentId } },
    create: { accountId, studentId, parentId, readAt: now },
    update: { readAt: now },
  });
  return messages.map((m) => ({
    id: m.id,
    text: m.text,
    createdAt: m.createdAt,
    mine: m.senderId === accountId,
    // Подпись: имя преподавателя или «Родитель»
    author: m.sender.teacher?.name ?? 'Родитель',
    fromParent: m.sender.role === 'PARENT',
  }));
}

export async function sendMessage(studentId: string, parentId: string, senderId: string, text: string) {
  await prisma.message.create({ data: { studentId, parentId, senderId, text } });
  return threadMessages(studentId, parentId, senderId);
}

/** Ветки для преподавателя: все переписки по ученикам его групп, новые сверху */
export async function teacherThreads(teacherId: string, accountId: string) {
  const last = await prisma.message.groupBy({
    by: ['studentId', 'parentId'],
    where: { student: { group: groupsOf(teacherId) } },
    _max: { createdAt: true },
  });
  if (!last.length) return [];
  const [links, reads] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { OR: last.map((l) => ({ studentId: l.studentId, parentId: l.parentId })) },
      include: { student: { select: { name: true, group: { select: { name: true } } } }, parent: { include: { account: { select: { login: true } } } } },
    }),
    prisma.threadRead.findMany({ where: { accountId } }),
  ]);
  const readAt = new Map(reads.map((r) => [`${r.studentId}|${r.parentId}`, r.readAt]));
  const rows = await Promise.all(
    last.map(async (l) => {
      const link = links.find((x) => x.studentId === l.studentId && x.parentId === l.parentId);
      if (!link) return null; // родителя уже отвязали — переписка скрыта
      const key = `${l.studentId}|${l.parentId}`;
      const [lastMessage, unread] = await Promise.all([
        prisma.message.findFirst({ where: { studentId: l.studentId, parentId: l.parentId }, orderBy: { createdAt: 'desc' } }),
        prisma.message.count({
          where: { studentId: l.studentId, parentId: l.parentId, senderId: { not: accountId }, ...(readAt.has(key) ? { createdAt: { gt: readAt.get(key)! } } : {}) },
        }),
      ]);
      return {
        studentId: l.studentId,
        parentId: l.parentId,
        studentName: link.student.name,
        groupName: link.student.group.name,
        parentLogin: link.parent.account.login,
        lastText: lastMessage!.text,
        lastAt: lastMessage!.createdAt,
        unread,
      };
    }),
  );
  return rows.filter((r) => r !== null).sort((a, b) => +b.lastAt - +a.lastAt);
}

/** Непрочитанные сообщения в ветках (для счётчика): от других участников после последнего просмотра */
export async function unreadMessages(accountId: string, threads: { studentId: string; parentId: string }[]): Promise<number> {
  if (!threads.length) return 0;
  const reads = await prisma.threadRead.findMany({ where: { accountId } });
  const readAt = new Map(reads.map((r) => [`${r.studentId}|${r.parentId}`, r.readAt]));
  const counts = await Promise.all(
    threads.map((t) => {
      const at = readAt.get(`${t.studentId}|${t.parentId}`);
      return prisma.message.count({
        where: { studentId: t.studentId, parentId: t.parentId, senderId: { not: accountId }, ...(at ? { createdAt: { gt: at } } : {}) },
      });
    }),
  );
  return counts.reduce((a, b) => a + b, 0);
}
