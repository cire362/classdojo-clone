import type { ChatMessage, TeacherThread, ThreadSummary } from '@heroes/shared/api';
import { scheduledAt } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { groupsOf } from '../access/index.js';

/**
 * Сообщения родителя и преподавателей группы о конкретном ребёнке. Ветка — пара (родитель, ученик):
 * её видят все преподаватели группы ученика и этот родитель. Ученики в переписке не участвуют.
 */
export const MAX_MESSAGE_LENGTH = 2000;

/** Ветка, доступная преподавателю: ученик в его группе, родитель привязан к ученику */
export async function teacherThread(teacherId: string, studentId: string, parentId: string): Promise<Omit<TeacherThread, 'messages'>> {
  const link = await prisma.parentStudent.findFirst({
    where: { studentId, parentId, student: { group: groupsOf(teacherId) } },
    include: {
      student: { select: { name: true, group: { select: { id: true, name: true, archivedAt: true } } } },
      parent: { include: { account: { select: { login: true } } } },
    },
  });
  if (!link) throw notFound('Переписка не найдена');
  const { group } = link.student;
  return {
    studentName: link.student.name,
    group: { ...group, archivedAt: group.archivedAt?.toISOString() ?? null },
    parentLogin: link.parent.account.login,
  };
}

/** Отложенные сообщения видят только преподаватели группы; родителю они придут в своё время */
export async function threadMessages(
  studentId: string,
  parentId: string,
  accountId: string,
  teacherView = false,
): Promise<ChatMessage[]> {
  const now = new Date();
  const messages = await prisma.message.findMany({
    where: { studentId, parentId, ...(teacherView ? {} : { createdAt: { lte: now } }) },
    orderBy: { createdAt: 'asc' },
    take: 500,
    include: { sender: { include: { teacher: { select: { name: true } } } } },
  });
  await prisma.threadRead.upsert({
    where: { accountId_studentId_parentId: { accountId, studentId, parentId } },
    create: { accountId, studentId, parentId, readAt: now },
    update: { readAt: now },
  });
  return messages.map((m) => ({
    id: m.id,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    mine: m.senderId === accountId,
    // Подпись: имя преподавателя или «Родитель»
    author: m.sender.teacher?.name ?? 'Родитель',
    fromParent: m.sender.role === 'PARENT',
    scheduled: m.createdAt > now,
  }));
}

export async function sendMessage(studentId: string, parentId: string, senderId: string, text: string): Promise<ChatMessage[]> {
  await prisma.message.create({ data: { studentId, parentId, senderId, text } });
  return threadMessages(studentId, parentId, senderId);
}

/** Сообщение преподавателя: сразу или в выбранное время */
export async function sendTeacherMessage(studentId: string, parentId: string, senderId: string, text: string, sendAt?: string) {
  const at = sendAt ? scheduledAt(sendAt) : undefined;
  await prisma.message.create({ data: { studentId, parentId, senderId, text, ...(at ? { createdAt: at } : {}) } });
  return threadMessages(studentId, parentId, senderId, true);
}

/** Отменить можно только своё сообщение и только пока оно не ушло */
export async function cancelMessage(studentId: string, parentId: string, messageId: string, accountId: string) {
  const { count } = await prisma.message.deleteMany({
    where: { id: messageId, studentId, parentId, senderId: accountId, createdAt: { gt: new Date() } },
  });
  if (!count) throw notFound('Сообщение уже отправлено');
  return threadMessages(studentId, parentId, accountId, true);
}

/**
 * Рассылка: у каждого родителя сообщение в его обычной ветке, ответ придёт туда же.
 * Родитель двоих детей группы получает его один раз: в ветке первого ребёнка.
 */
export async function broadcastMessage(groupId: string, senderId: string, text: string, sendAt?: string) {
  const at = sendAt ? scheduledAt(sendAt) : undefined;
  const links = await prisma.parentStudent.findMany({
    where: { student: { groupId } },
    orderBy: { student: { name: 'asc' } },
    select: { parentId: true, studentId: true },
  });
  const byParent = new Map(links.map((l) => [l.parentId, l]).reverse() as [string, (typeof links)[number]][]);
  if (!byParent.size) throw new HttpError(400, 'В группе пока нет родителей с входом');
  const data = [...byParent.values()].map((l) => ({ ...l, senderId, text, ...(at ? { createdAt: at } : {}) }));
  await prisma.message.createMany({ data });
  return { sent: data.length };
}

/** Ветки для преподавателя: все переписки по ученикам его групп, новые сверху */
export async function teacherThreads(teacherId: string, accountId: string): Promise<ThreadSummary[]> {
  const now = new Date();
  const last = await prisma.message.groupBy({
    by: ['studentId', 'parentId'],
    where: { student: { group: groupsOf(teacherId) }, createdAt: { lte: now } },
    _max: { createdAt: true },
  });
  if (!last.length) return [];
  const [links, reads] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { OR: last.map((l) => ({ studentId: l.studentId, parentId: l.parentId })) },
      include: {
        student: { select: { name: true, group: { select: { name: true } } } },
        parent: { include: { account: { select: { login: true } } } },
      },
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
        prisma.message.findFirst({
          where: { studentId: l.studentId, parentId: l.parentId, createdAt: { lte: now } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.message.count({
          where: {
            studentId: l.studentId,
            parentId: l.parentId,
            senderId: { not: accountId },
            createdAt: { lte: now, ...(readAt.has(key) ? { gt: readAt.get(key)! } : {}) },
          },
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
  return rows
    .filter((r) => r !== null)
    .sort((a, b) => +b.lastAt - +a.lastAt)
    .map((r) => ({ ...r, lastAt: r.lastAt.toISOString() }));
}

/** Непрочитанные сообщения в ветках (для счётчика): от других участников после последнего просмотра */
export async function unreadMessages(accountId: string, threads: { studentId: string; parentId: string }[]): Promise<number> {
  if (!threads.length) return 0;
  const reads = await prisma.threadRead.findMany({ where: { accountId } });
  const readAt = new Map(reads.map((r) => [`${r.studentId}|${r.parentId}`, r.readAt]));
  const now = new Date();
  const counts = await Promise.all(
    threads.map((t) => {
      const at = readAt.get(`${t.studentId}|${t.parentId}`);
      return prisma.message.count({
        where: {
          studentId: t.studentId,
          parentId: t.parentId,
          senderId: { not: accountId },
          createdAt: { lte: now, ...(at ? { gt: at } : {}) },
        },
      });
    }),
  );
  return counts.reduce((a, b) => a + b, 0);
}
