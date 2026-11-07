import type { ChatMessage, InboxThread, InboxThreadDetail, ParentSchoolThread } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { lockSchool, schoolsOf } from '../access/index.js';
import { addSchoolFileRows, fileView, prepareUpload, purgeDeletedFiles, writeUploads, type Upload } from '../files/index.js';

/**
 * Единый ящик школы: родитель пишет администрации, отвечает любой её сотрудник. Переписка ждёт ответа,
 * пока школа не ответит или не отметит вопрос решённым; так ящик показывает, что ещё не разобрано.
 */
export const MAX_SCHOOL_ATTACHMENTS = 5;
/** Сообщений родителя подряд без ответа школы; дальше нужно дождаться ответа */
export const MAX_UNANSWERED = 20;
/** Последние сообщения переписки и переписки в ящике */
const MESSAGES = 200;
const THREADS = 100;

const MESSAGE_INCLUDE = { files: { orderBy: { position: 'asc' } } } as const satisfies Prisma.SchoolMessageInclude;
type LoadedMessage = Prisma.SchoolMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

function messageView(m: LoadedMessage, accountId: string): ChatMessage {
  return {
    id: m.id,
    text: m.text,
    files: m.files.map(fileView),
    createdAt: m.createdAt.toISOString(),
    mine: m.senderId === accountId,
    author: m.fromSchool ? `${m.authorName || 'Сотрудник'}, администрация школы` : 'Родитель',
    fromParent: !m.fromSchool,
    scheduled: false,
  };
}

async function threadMessages(threadId: string, accountId: string) {
  const rows = await prisma.schoolMessage.findMany({
    where: { threadId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: MESSAGES,
    include: MESSAGE_INCLUDE,
  });
  return rows.reverse().map((m) => messageView(m, accountId));
}

/** Сообщение с файлами сохраняется целиком или никак */
async function addMessage(
  schoolId: string,
  data: { parentId: string; senderId: string; authorName: string; fromSchool: boolean; text: string },
  files: File[],
) {
  if (!data.text && !files.length) throw new HttpError(400, 'Напишите сообщение или приложите файл');
  if (files.length > MAX_SCHOOL_ATTACHMENTS) {
    throw new HttpError(400, `К сообщению можно приложить не больше ${MAX_SCHOOL_ATTACHMENTS} файлов`);
  }
  const uploads: Upload[] = [];
  for (const file of files) uploads.push(await prepareUpload(file));
  const now = new Date();
  const { thread, message, rows } = await prisma.$transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    const thread = await tx.schoolThread.upsert({
      where: { schoolId_parentId: { schoolId, parentId: data.parentId } },
      create: { schoolId, parentId: data.parentId },
      update: {},
    });
    if (!data.fromSchool && thread.waitingSince) {
      const since = { threadId: thread.id, fromSchool: false, createdAt: { gte: thread.waitingSince } };
      const waiting = await tx.schoolMessage.count({ where: since });
      if (waiting >= MAX_UNANSWERED) throw new HttpError(409, 'Дождитесь ответа школы на предыдущие сообщения');
    }
    const message = await tx.schoolMessage.create({
      data: {
        threadId: thread.id,
        senderId: data.senderId,
        authorName: data.authorName,
        fromSchool: data.fromSchool,
        text: data.text,
        createdAt: now,
      },
    });
    await tx.schoolThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: now,
        // Ответ школы закрывает ожидание; новое сообщение родителя открывает его, если оно было закрыто
        waitingSince: data.fromSchool ? null : (thread.waitingSince ?? now),
        ...(data.fromSchool ? {} : { parentReadAt: now }),
      },
    });
    const place = { schoolMessageId: message.id };
    const rows = uploads.length ? await addSchoolFileRows(tx, schoolId, place, data.senderId, uploads) : [];
    return { thread, message, rows };
  });
  try {
    await writeUploads(rows, uploads);
  } catch (err) {
    await prisma.schoolMessage.delete({ where: { id: message.id } });
    await purgeDeletedFiles();
    throw err;
  }
  return thread.id;
}

// ——— Родитель ———

/** Переписки родителя со школами его детей. Просмотр отмечает ответы школы прочитанными */
export async function parentSchoolThreads(user: AuthUser): Promise<ParentSchoolThread[]> {
  const schoolIds = await schoolsOf(user);
  const schools = await prisma.school.findMany({
    where: { id: { in: schoolIds } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, threads: { where: { parentId: user.parentId! }, select: { id: true } } },
  });
  const result = [];
  for (const school of schools) {
    const threadId = school.threads[0]?.id;
    const messages = threadId ? await threadMessages(threadId, user.accountId) : [];
    result.push({ schoolId: school.id, schoolName: school.name, messages });
  }
  const mine = { parentId: user.parentId!, schoolId: { in: schoolIds } };
  await prisma.schoolThread.updateMany({ where: mine, data: { parentReadAt: new Date() } });
  return result;
}

export async function parentWrite(user: AuthUser, schoolId: string, text: string, files: File[]): Promise<ChatMessage[]> {
  if (!(await schoolsOf(user)).includes(schoolId)) throw notFound('Школа не найдена');
  const threadId = await addMessage(schoolId, {
    parentId: user.parentId!, senderId: user.accountId, authorName: '', fromSchool: false, text,
  }, files);
  return threadMessages(threadId, user.accountId);
}

/** Новых ответов школы, которые родитель ещё не видел */
export async function unreadSchoolReplies(user: AuthUser): Promise<number> {
  const schoolIds = await schoolsOf(user);
  if (!schoolIds.length) return 0;
  const threads = await prisma.schoolThread.findMany({
    where: { parentId: user.parentId!, schoolId: { in: schoolIds } },
    select: { id: true, parentReadAt: true },
  });
  const counts = await Promise.all(threads.map((t) => prisma.schoolMessage.count({
    where: { threadId: t.id, fromSchool: true, ...(t.parentReadAt ? { createdAt: { gt: t.parentReadAt } } : {}) },
  })));
  return counts.reduce((a, b) => a + b, 0);
}

// ——— Администрация школы ———

const CHILD = { name: true, group: { select: { name: true, teacher: { select: { schoolId: true } } } } } as const;

const THREAD_SELECT = {
  id: true,
  schoolId: true,
  waitingSince: true,
  lastMessageAt: true,
  parent: { select: { children: { select: { student: { select: CHILD } } } } },
  messages: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { text: true, fromSchool: true, files: { select: { id: true } } },
  },
} as const satisfies Prisma.SchoolThreadSelect;
type LoadedThread = Prisma.SchoolThreadGetPayload<{ select: typeof THREAD_SELECT }>;

/** Подпись семьи: только дети из этой школы, чтобы не раскрывать другие школы родителя */
function threadView(t: LoadedThread): InboxThread {
  const children = t.parent.children
    .filter((c) => c.student.group.teacher.schoolId === t.schoolId)
    .map((c) => `${c.student.name} (${c.student.group.name})`)
    .sort();
  const last = t.messages[0];
  return {
    id: t.id,
    family: children.length ? `Родитель: ${children.join(', ')}` : 'Родитель',
    lastText: last ? last.text || (last.files.length ? 'Файл' : '') : '',
    lastFromSchool: last?.fromSchool ?? false,
    lastMessageAt: t.lastMessageAt.toISOString(),
    waiting: !!t.waitingSince,
  };
}

/** Сначала ждущие ответа, самые давние сверху; затем остальные по свежести */
export async function schoolInbox(schoolId: string): Promise<InboxThread[]> {
  const [waiting, rest] = await Promise.all([
    prisma.schoolThread.findMany({
      where: { schoolId, waitingSince: { not: null } }, orderBy: { waitingSince: 'asc' }, take: THREADS, select: THREAD_SELECT,
    }),
    prisma.schoolThread.findMany({
      where: { schoolId, waitingSince: null }, orderBy: { lastMessageAt: 'desc' }, take: THREADS, select: THREAD_SELECT,
    }),
  ]);
  return [...waiting, ...rest].map(threadView);
}

async function schoolThread(schoolId: string, threadId: string) {
  const thread = await prisma.schoolThread.findFirst({ where: { id: threadId, schoolId }, select: THREAD_SELECT });
  if (!thread) throw notFound('Переписка не найдена');
  return thread;
}

export async function inboxThread(user: AuthUser, threadId: string): Promise<InboxThreadDetail> {
  const thread = await schoolThread(user.schoolId!, threadId);
  return { ...threadView(thread), messages: await threadMessages(thread.id, user.accountId) };
}

export async function schoolReply(user: AuthUser, threadId: string, text: string, files: File[]): Promise<InboxThreadDetail> {
  const thread = await prisma.schoolThread.findFirst({ where: { id: threadId, schoolId: user.schoolId! }, select: { parentId: true } });
  if (!thread) throw notFound('Переписка не найдена');
  await addMessage(user.schoolId!, {
    parentId: thread.parentId, senderId: user.accountId, authorName: user.name, fromSchool: true, text,
  }, files);
  return inboxThread(user, threadId);
}

/** Вопрос решён без письменного ответа, например по телефону */
export async function markHandled(user: AuthUser, threadId: string): Promise<InboxThreadDetail> {
  const where = { id: threadId, schoolId: user.schoolId! };
  const { count } = await prisma.schoolThread.updateMany({ where, data: { waitingSince: null } });
  if (!count) throw notFound('Переписка не найдена');
  return inboxThread(user, threadId);
}

export const waitingThreads = (schoolId: string) => prisma.schoolThread.count({ where: { schoolId, waitingSince: { not: null } } });
