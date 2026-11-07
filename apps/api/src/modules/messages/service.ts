import type { ChatMessage, TeacherThread, ThreadSummary } from '@heroes/shared/api';
import { scheduledAt } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { cap } from '@heroes/shared/terms';
import { terms } from '../../platform/terms.js';
import { groupsOf } from '../access/index.js';
import { attachmentsOf, createBroadcast, createMessage, dropMessageFiles } from './attachments.service.js';
import { markRead, readTimes, threadKey, unreadIn, type ThreadKey } from './reads.service.js';

/**
 * Сообщения о конкретном ученике. Ветка — пара (родитель, ученик): её видят все преподаватели группы и этот родитель.
 * В колледже и вузе есть и ветка самого студента с преподавателями группы — без родителя (parentId = null).
 * Школьники в переписке не участвуют.
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

/** Отложенные сообщения видят только преподаватели группы; родителю и студенту они придут в своё время */
export async function threadMessages(
  studentId: string,
  parentId: string | null,
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
  const filesOf = await attachmentsOf(messages);
  await markRead(accountId, { studentId, parentId }, now);
  const studentLabel = cap(terms().student.one.nom);
  return messages.map((m) => ({
    id: m.id,
    text: m.text,
    files: filesOf(m),
    createdAt: m.createdAt.toISOString(),
    mine: m.senderId === accountId,
    // Подпись: имя преподавателя, «Студент» или «Родитель»
    author: m.sender.teacher?.name ?? (m.sender.role === 'STUDENT' ? studentLabel : 'Родитель'),
    fromParent: m.sender.role === 'PARENT',
    scheduled: m.createdAt > now,
  }));
}

export async function sendMessage(studentId: string, parentId: string | null, senderId: string, text: string, files: File[] = []) {
  await createMessage({ studentId, parentId, senderId, text }, files);
  return threadMessages(studentId, parentId, senderId);
}

/** Сообщение преподавателя: сразу или в выбранное время */
export async function sendTeacherMessage(
  studentId: string,
  parentId: string | null,
  senderId: string,
  message: { text: string; sendAt?: string; files?: File[] },
) {
  const at = message.sendAt ? scheduledAt(message.sendAt) : undefined;
  await createMessage({ studentId, parentId, senderId, text: message.text, ...(at ? { createdAt: at } : {}) }, message.files);
  return threadMessages(studentId, parentId, senderId, true);
}

/** Отменить можно только своё сообщение и только пока оно не ушло */
export async function cancelMessage(studentId: string, parentId: string | null, messageId: string, accountId: string) {
  const where = { id: messageId, studentId, parentId, senderId: accountId, createdAt: { gt: new Date() } };
  const message = await prisma.message.findFirst({ where, select: { broadcastId: true } });
  const { count } = await prisma.message.deleteMany({ where });
  if (!message || !count) throw notFound('Сообщение уже отправлено');
  await dropMessageFiles(message.broadcastId);
  return threadMessages(studentId, parentId, accountId, true);
}

/**
 * Рассылка: у каждого родителя сообщение в его обычной ветке, ответ придёт туда же.
 * Родитель двоих детей группы получает его один раз: в ветке первого ребёнка.
 */
export async function broadcastMessage(groupId: string, senderId: string, message: { text: string; sendAt?: string; files?: File[] }) {
  const { text, sendAt, files } = message;
  const at = sendAt ? scheduledAt(sendAt) : undefined;
  const links = await prisma.parentStudent.findMany({
    where: { student: { groupId } },
    orderBy: { student: { name: 'asc' } },
    select: { parentId: true, studentId: true },
  });
  const byParent = new Map(links.map((l) => [l.parentId, l]).reverse() as [string, (typeof links)[number]][]);
  if (!byParent.size) throw new HttpError(400, 'В группе пока нет родителей с входом');
  await createBroadcast(groupId, [...byParent.values()], senderId, text, at, files);
  return { sent: byParent.size };
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
  const withParent = last.filter((l): l is typeof l & { parentId: string } => l.parentId !== null);
  const [links, students, reads] = await Promise.all([
    withParent.length
      ? prisma.parentStudent.findMany({
        where: { OR: withParent.map((l) => ({ studentId: l.studentId, parentId: l.parentId })) },
        include: { parent: { include: { account: { select: { login: true } } } } },
      })
      : [],
    prisma.student.findMany({
      where: { id: { in: [...new Set(last.map((l) => l.studentId))] } },
      select: { id: true, name: true, group: { select: { name: true } } },
    }),
    readTimes(accountId),
  ]);
  const studentOf = new Map(students.map((st) => [st.id, st]));
  const rows = await Promise.all(
    last.map(async (l) => {
      const link = l.parentId ? links.find((x) => x.studentId === l.studentId && x.parentId === l.parentId) : null;
      if (l.parentId && !link) return null; // родителя уже отвязали — переписка скрыта
      const key: ThreadKey = { studentId: l.studentId, parentId: l.parentId };
      const [lastMessage, unread] = await Promise.all([
        prisma.message.findFirst({ where: { ...key, createdAt: { lte: now } }, orderBy: { createdAt: 'desc' } }),
        unreadIn(key, accountId, reads.get(threadKey(key)), now),
      ]);
      const student = studentOf.get(l.studentId)!;
      return {
        studentId: l.studentId,
        parentId: l.parentId,
        studentName: student.name,
        groupName: student.group.name,
        parentLogin: link?.parent.account.login ?? null,
        lastText: lastMessage!.text || 'Вложение',
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
