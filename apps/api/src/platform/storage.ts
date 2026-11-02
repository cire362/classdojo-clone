import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { env } from './env.js';

/**
 * Байты файлов в томе. Это весь интерфейс хранилища: при замене тома меняется только этот файл.
 * id приходит из базы, а не из запроса. Вложенная папка не даёт одному каталогу разрастись.
 */
const location = (id: string) => join(env.filesDir, id.slice(-2), id);

/** Запись через временный файл: при сбое на диске не останется половины файла под настоящим именем */
export async function putBytes(id: string, bytes: Uint8Array) {
  const path = location(id);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(`${path}.tmp`, bytes, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

/** Поток байтов или null, если файла на диске нет */
export async function readBytes(id: string): Promise<ReadableStream<Uint8Array> | null> {
  const path = location(id);
  const found = await stat(path).catch(() => null);
  return found ? (Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>) : null;
}

export async function removeBytes(id: string) {
  await rm(location(id), { force: true });
  await rm(`${location(id)}.tmp`, { force: true });
}
