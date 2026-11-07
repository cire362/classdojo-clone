import type { FileInfo } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { env } from '../../platform/env.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { putBytes, removeBytes, sizeOf } from '../../platform/storage.js';
import { addDays } from '../../platform/dates.js';
import { lockGroup } from '../access/index.js';
import { isPhoto, rebuildPhoto } from './photo.js';
import { sniffType } from './sniff.js';
import { stripVideoMetadata } from './video.js';

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

export const view = (f: Omit<FileInfo, 'createdAt'> & { createdAt: Date }): FileInfo => ({
  id: f.id,
  name: f.name,
  mime: f.mime,
  size: f.size,
  createdAt: f.createdAt.toISOString(),
});

/**
 * documents — фото и PDF для работ и вложений, media — фото и видео для ленты.
 * Проверка, пересборка фото и очистка видео идут до транзакции: это долго, а группа блокируется ненадолго.
 * У видео превью — обложка, снятая браузером: сервер не декодирует видео.
 */
export async function prepareUpload(file: File, kind: 'documents' | 'media' = 'documents', poster?: File): Promise<Upload> {
  const limit = kind === 'media' ? Math.max(env.maxFileBytes, env.maxVideoBytes) : env.maxFileBytes;
  if (file.size > limit) throw new HttpError(413, 'Файл слишком большой');
  const raw = new Uint8Array(await file.arrayBuffer());
  const mime = sniffType(raw);
  const allowed = kind === 'media' ? isPhoto(mime ?? '') || mime === 'video/mp4' : mime !== 'video/mp4';
  if (!mime || !allowed) {
    const hint = kind === 'media' ? 'Подходят фото JPEG и PNG и видео MP4 и MOV' : 'Подходят только фото JPEG и PNG и файлы PDF';
    throw new HttpError(415, hint);
  }
  if (mime === 'video/mp4') {
    return { name: cleanName(file.name), mime, bytes: stripVideoMetadata(raw), preview: poster ? await posterBytes(poster) : null };
  }
  if (raw.length > env.maxFileBytes) throw new HttpError(413, 'Фото слишком большое');
  const photo = isPhoto(mime) ? await rebuildPhoto(raw, mime) : null;
  return { name: cleanName(file.name), mime, bytes: photo?.full ?? raw, preview: photo?.preview ?? null };
}

/** Обложка проходит ту же пересборку, что и фото: метаданных в ней тоже не будет */
async function posterBytes(poster: File) {
  if (poster.size > env.maxFileBytes) throw new HttpError(413, 'Обложка видео слишком большая');
  const raw = new Uint8Array(await poster.arrayBuffer());
  const mime = sniffType(raw);
  if (!mime || !isPhoto(mime)) throw new HttpError(415, 'Обложка видео должна быть JPEG или PNG');
  return (await rebuildPhoto(raw, mime)).full;
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
  place: { postId?: string; messageId?: string; broadcastId?: string; workId?: string; assignmentId?: string; visibleFrom?: Date } = {},
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

/**
 * Файлы школы — ленты и переписки с семьями — не принадлежат группе, поэтому у них своя квота того же размера.
 * Школа уже заблокирована вызывающим, как группа в addFileRows.
 */
export async function addSchoolFileRows(
  tx: Prisma.TransactionClient,
  schoolId: string,
  place: { schoolPostId: string } | { schoolMessageId: string },
  uploaderId: string,
  uploads: Upload[],
) {
  const { _sum } = await tx.storedFile.aggregate({
    where: { OR: [{ schoolPost: { schoolId } }, { schoolMessage: { thread: { schoolId } } }] },
    _sum: { size: true },
  });
  const adding = uploads.reduce((sum, u) => sum + u.bytes.length, 0);
  if ((_sum.size ?? 0) + adding > env.groupFilesQuota) throw new HttpError(409, 'Место для файлов учреждения закончилось');
  const rows = [];
  for (const [position, u] of uploads.entries()) {
    rows.push(await tx.storedFile.create({
      data: { ...place, position, uploadedById: uploaderId, name: u.name, mime: u.mime, size: u.bytes.length },
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
  const file = await prisma.storedFile.findUnique({
    where: { id },
    include: {
      message: { select: { studentId: true, parentId: true } },
      post: { select: { hiddenAt: true } },
      work: { select: { status: true } },
      schoolPost: { select: { schoolId: true } },
      schoolMessage: { select: { thread: { select: { schoolId: true, parentId: true } } } },
    },
  });
  if (!file) throw notFound('Файл не найден');
  return file;
}

/**
 * Ключ на диске и размер. preview: уменьшенная копия фото или обложка видео. У PDF превью нет, и отдаётся сам
 * файл, а видео без обложки отвечает 404: подставлять вместо картинки целый ролик нельзя.
 */
export async function fileBytes(file: { id: string; mime: string }, preview = false) {
  if (preview) {
    const size = await sizeOf(previewKey(file.id));
    if (size !== null) return { key: previewKey(file.id), size };
    if (file.mime.startsWith('video/')) throw notFound('У видео нет обложки');
  }
  const size = await sizeOf(file.id);
  if (size === null) throw notFound('Файл не найден');
  return { key: file.id, size };
}

export async function deleteFile(id: string) {
  await prisma.storedFile.delete({ where: { id } });
  await purgeDeletedFiles();
}

/** Когда удалятся файлы архивной группы; у действующей группы срока нет */
export const filesExpireAt = (archivedAt: Date | null) => (archivedAt ? addDays(archivedAt, env.archivedFilesDays) : null);

/**
 * Срок хранения: файлы групп, которые лежат в архиве дольше ARCHIVED_FILES_DAYS, удаляются вместе с файлами
 * их учеников. Сама группа, баллы и статистика остаются. Возврат из архива до срока отменяет удаление.
 */
export async function expireArchivedFiles(now = new Date()) {
  const archived = { archivedAt: { lte: addDays(now, -env.archivedFilesDays) } };
  const { count } = await prisma.storedFile.deleteMany({ where: { OR: [{ group: archived }, { student: { group: archived } }] } });
  if (count) await purgeDeletedFiles();
  return count;
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
