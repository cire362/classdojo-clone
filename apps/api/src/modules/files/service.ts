import type { FileInfo } from '@heroes/shared/api';
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

type Owner = { groupId: string; studentId?: undefined } | { studentId: string; groupId?: undefined };

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

/**
 * Строка создаётся раньше байтов: при сбое останется запись без файла, а не файл, про который никто
 * не знает и который никогда не удалится. Группа блокируется, чтобы параллельные загрузки не обошли лимит.
 */
export async function storeFile(owner: Owner, groupId: string, uploaderId: string, file: File): Promise<FileInfo> {
  if (file.size > env.maxFileBytes) throw new HttpError(413, 'Файл слишком большой');
  const raw = new Uint8Array(await file.arrayBuffer());
  const mime = sniffType(raw);
  if (!mime) throw new HttpError(415, 'Подходят только фото JPEG и PNG и файлы PDF');
  const photo = isPhoto(mime) ? await rebuildPhoto(raw, mime) : null;
  const bytes = photo?.full ?? raw;
  const row = await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const { _sum } = await tx.storedFile.aggregate({
      where: { OR: [{ groupId }, { student: { groupId } }] },
      _sum: { size: true },
    });
    if ((_sum.size ?? 0) + bytes.length > env.groupFilesQuota) throw new HttpError(409, 'Место для файлов группы закончилось');
    return tx.storedFile.create({ data: { ...owner, uploadedById: uploaderId, name: cleanName(file.name), mime, size: bytes.length } });
  });
  try {
    await putBytes(row.id, bytes);
    if (photo) await putBytes(previewKey(row.id), photo.preview);
  } catch (err) {
    await prisma.storedFile.delete({ where: { id: row.id } });
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
 * Удаляет с диска файлы, строки которых исчезли: триггер в базе ловит и каскады от ученика, группы
 * и преподавателя. Ошибка диска не мешает удалению в базе: файл уже недоступен, очистка повторится.
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
