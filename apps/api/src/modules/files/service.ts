import type { FileInfo } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { env } from '../../platform/env.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { putBytes, readBytes, removeBytes } from '../../platform/storage.js';
import { lockGroup } from '../access/index.js';
import { isPhoto, rebuildPhoto } from './photo.js';
import { sniffType } from './sniff.js';

/** Загрузка и удаление файлов. Какой файл кому показывать, решают routes через модуль access */
const PURGE_BATCH = 500;
const MAX_NAME = 120;

/** Уменьшенная копия фото для списков и ленты */
export const previewKey = (id: string) => `${id}-preview`;

export type Owner = { groupId: string; studentId?: undefined } | { studentId: string; groupId?: undefined };

/** Проверенный файл, готовый к записи */
export type Upload = { name: string; mime: string; bytes: Uint8Array; preview: Uint8Array | null };

/** Имя только для показа и скачивания: на диске файл лежит под своим id */
function cleanName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? '';
  return base.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(-MAX_NAME) || 'файл';
}

const view = (f: Omit<FileInfo, 'createdAt'> & { createdAt: Date }): FileInfo => ({
  id: f.id,
  name: f.name,
  mime: f.mime,
  size: f.size,
  createdAt: f.createdAt.toISOString(),
});

/** Проверка и пересборка фото идут до транзакции: это долго, а группа блокируется ненадолго */
export async function prepareUpload(file: File, photosOnly = false): Promise<Upload> {
  if (file.size > env.maxFileBytes) throw new HttpError(413, 'Файл слишком большой');
  const raw = new Uint8Array(await file.arrayBuffer());
  const mime = sniffType(raw);
  if (!mime || (photosOnly && !isPhoto(mime))) {
    throw new HttpError(415, photosOnly ? 'Подходят только фото JPEG и PNG' : 'Подходят только фото JPEG и PNG и файлы PDF');
  }
  const photo = isPhoto(mime) ? await rebuildPhoto(raw, mime) : null;
  return { name: cleanName(file.name), mime, bytes: photo?.full ?? raw, preview: photo?.preview ?? null };
}

/**
 * Строки файлов в транзакции вызывающего, группа уже заблокирована: параллельные загрузки не обойдут лимит.
 * Строки создаются раньше байтов: при сбое останется запись без файла, а не файл, про который никто не знает.
 */
export async function addFileRows(
  tx: Prisma.TransactionClient,
  groupId: string,
  owner: Owner,
  uploaderId: string,
  uploads: Upload[],
  place: { postId?: string; visibleFrom?: Date } = {},
) {
  const { _sum } = await tx.storedFile.aggregate({ where: { OR: [{ groupId }, { student: { groupId } }] }, _sum: { size: true } });
  const adding = uploads.reduce((sum, u) => sum + u.bytes.length, 0);
  if ((_sum.size ?? 0) + adding > env.groupFilesQuota) throw new HttpError(409, 'Место для файлов группы закончилось');
  const rows = [];
  for (const [position, u] of uploads.entries()) {
    rows.push(await tx.storedFile.create({
      data: { ...owner, ...place, position, uploadedById: uploaderId, name: u.name, mime: u.mime, size: u.bytes.length },
    }));
  }
  return rows;
}

/** Байты после транзакции. При сбое вызывающий удаляет строки, а очередь сотрёт уже записанное */
export async function writeUploads(rows: { id: string }[], uploads: Upload[]) {
  for (const [i, { id }] of rows.entries()) {
    await putBytes(id, uploads[i].bytes);
    if (uploads[i].preview) await putBytes(previewKey(id), uploads[i].preview!);
  }
}

export async function storeFile(owner: Owner, groupId: string, uploaderId: string, file: File): Promise<FileInfo> {
  const upload = await prepareUpload(file);
  const [row] = await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    return addFileRows(tx, groupId, owner, uploaderId, [upload]);
  });
  try {
    await writeUploads([row], [upload]);
  } catch (err) {
    await deleteFile(row.id);
    throw err;
  }
  return view(row);
}

export async function findFile(id: string) {
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) throw notFound('Файл не найден');
  return file;
}

/** preview: уменьшенная копия, если она есть; у PDF её нет, и отдаётся сам файл */
export async function fileBytes(id: string, preview = false) {
  const bytes = (preview && (await readBytes(previewKey(id)))) || (await readBytes(id));
  if (!bytes) throw notFound('Файл не найден');
  return bytes;
}

export async function deleteFile(id: string) {
  await prisma.storedFile.delete({ where: { id } });
  await purgeDeletedFiles();
}

/**
 * Удаляет с диска файлы, строки которых исчезли: триггер в базе ловит и каскады от ученика, группы,
 * записи ленты и преподавателя. Ошибка диска не мешает удалению в базе: файл уже недоступен, очистка повторится.
 */
export async function purgeDeletedFiles() {
  const queue = await prisma.deletedFile.findMany({ take: PURGE_BATCH, orderBy: { deletedAt: 'asc' } });
  for (const { id } of queue) {
    try {
      await removeBytes(id);
      await removeBytes(previewKey(id));
      await prisma.deletedFile.delete({ where: { id } });
    } catch (err) {
      console.error('Не удалось удалить файл', id, err);
    }
  }
}
