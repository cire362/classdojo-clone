import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { env } from './env.js';

/**
 * Байты файлов в томе. Это весь интерфейс хранилища: при замене тома меняется только этот файл.
 * Ключ приходит из базы, а не из запроса. Вложенная папка по хешу не даёт одному каталогу разрастись.
 */
const location = (key: string) => join(env.filesDir, createHash('sha256').update(key).digest('hex').slice(0, 2), key);

/** Запись через временный файл: при сбое на диске не останется половины файла под настоящим именем */
export async function putBytes(key: string, bytes: Uint8Array) {
  const path = location(key);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(`${path}.tmp`, bytes, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

/** Размер в байтах или null, если на диске ничего нет */
export async function sizeOf(key: string): Promise<number | null> {
  const found = await stat(location(key)).catch(() => null);
  return found?.size ?? null;
}

/** Поток байтов целиком или части: end включительно, как в заголовке Range */
export function streamBytes(key: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(location(key), range)) as ReadableStream<Uint8Array>;
}

/** Файл целиком в память: только для небольших файлов, например чтобы отдать документ сервису просмотра */
export async function readBytes(key: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(location(key)));
}

export async function removeBytes(key: string) {
  await rm(location(key), { force: true });
  await rm(`${location(key)}.tmp`, { force: true });
}
