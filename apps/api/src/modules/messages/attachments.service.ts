import type { FileInfo } from '@heroes/shared/api';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../platform/db.js';
import { HttpError } from '../../platform/errors.js';
import { lockGroup } from '../access/index.js';
import { addFileRows, fileView, prepareUpload, purgeDeletedFiles, writeUploads, type Upload } from '../files/index.js';

/** Фото и PDF в переписке: родитель присылает справку, преподаватель — памятку или задание */
export const MAX_ATTACHMENTS = 5;

type NewMessage = { studentId: string; parentId: string; senderId: string; text: string; createdAt?: Date };

/** Проверка и пересборка файлов идут до транзакции: это долго, а группа блокируется ненадолго */
async function prepare(text: string, files: File[]) {
  if (!text && !files.length) throw new HttpError(400, 'Напишите сообщение или приложите файл');
  if (files.length > MAX_ATTACHMENTS) throw new HttpError(400, `К сообщению можно приложить не больше ${MAX_ATTACHMENTS} файлов`);
  const uploads: Upload[] = [];
  for (const file of files) uploads.push(await prepareUpload(file));
  return uploads;
}

/** Байты пишутся после транзакции. При сбое сообщение снимается, а очередь сотрёт уже записанное */
async function writeOrUndo(rows: { id: string }[], uploads: Upload[], undo: () => Promise<unknown>) {
  try {
    await writeUploads(rows, uploads);
  } catch (err) {
    await undo();
    await purgeDeletedFiles();
    throw err;
  }
}

/**
 * Вложения лежат у ученика: занимают место группы и удаляются вместе с ним или с сообщением.
 * Файлы отложенного сообщения родитель не откроет раньше, чем увидит само сообщение.
 */
export async function createMessage(data: NewMessage, files: File[] = []) {
  const uploads = await prepare(data.text, files);
  if (!uploads.length) return void (await prisma.message.create({ data }));
  const { groupId } = await prisma.student.findUniqueOrThrow({ where: { id: data.studentId }, select: { groupId: true } });
  const { message, rows } = await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const message = await tx.message.create({ data });
    const place = { messageId: message.id, visibleFrom: data.createdAt };
    return { message, rows: await addFileRows(tx, groupId, { studentId: data.studentId }, data.senderId, uploads, place) };
  });
  await writeOrUndo(rows, uploads, () => prisma.message.delete({ where: { id: message.id } }));
}

/** Копии рассылки по веткам; вложения хранятся один раз на все копии, у группы */
export async function createBroadcast(
  groupId: string,
  threads: { studentId: string; parentId: string }[],
  senderId: string,
  text: string,
  at: Date | undefined,
  files: File[] = [],
) {
  const uploads = await prepare(text, files);
  const broadcastId = randomUUID();
  const data = threads.map((t) => ({ ...t, senderId, text, broadcastId, ...(at ? { createdAt: at } : {}) }));
  if (!uploads.length) return void (await prisma.message.createMany({ data }));
  const rows = await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    await tx.message.createMany({ data });
    return addFileRows(tx, groupId, { groupId }, senderId, uploads, { broadcastId, visibleFrom: at });
  });
  await writeOrUndo(rows, uploads, async () => {
    await prisma.message.deleteMany({ where: { broadcastId } });
    await prisma.storedFile.deleteMany({ where: { broadcastId } });
  });
}

/** Вложения сообщений по порядку: у обычного — свои, у копии рассылки — общие для всех копий */
export async function attachmentsOf(messages: { id: string; broadcastId: string | null }[]) {
  const broadcastIds = [...new Set(messages.flatMap((m) => (m.broadcastId ? [m.broadcastId] : [])))];
  const files = await prisma.storedFile.findMany({
    where: { OR: [{ messageId: { in: messages.map((m) => m.id) } }, { broadcastId: { in: broadcastIds } }] },
    orderBy: { position: 'asc' },
  });
  const byKey = new Map<string, FileInfo[]>();
  for (const f of files) {
    const key = f.messageId ?? f.broadcastId!;
    byKey.set(key, [...(byKey.get(key) ?? []), fileView(f)]);
  }
  return (m: { id: string; broadcastId: string | null }) => byKey.get(m.id) ?? (m.broadcastId ? byKey.get(m.broadcastId) : undefined) ?? [];
}

/** Вложения рассылки уходят вместе с последней её копией; свои вложения сообщения база удаляет каскадом */
export async function dropMessageFiles(broadcastId: string | null) {
  if (broadcastId && !(await prisma.message.count({ where: { broadcastId } }))) {
    await prisma.storedFile.deleteMany({ where: { broadcastId } });
  }
  await purgeDeletedFiles();
}
