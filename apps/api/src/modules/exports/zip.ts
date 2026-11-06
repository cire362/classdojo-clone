import { Zip, ZipPassThrough } from 'fflate';
import { sizeOf, streamBytes } from '../../platform/storage.js';

/** Файл архива: байты из хранилища по ключу или готовые, например пояснение к архиву */
export type ZipEntry = { path: string; date: Date } & ({ key: string } | { bytes: Uint8Array });

/**
 * ZIP без сжатия: фото, видео и PDF уже сжаты. Архив собирается потоком по мере чтения, файл за файлом,
 * поэтому даже группа на сотни мегабайт не занимает память сервера. Файлы, которых нет на диске, пропускаются.
 */
export async function zipStream(entries: ZipEntry[]): Promise<ReadableStream<Uint8Array>> {
  const present: ZipEntry[] = [];
  for (const e of entries) if (!('key' in e) || (await sizeOf(e.key)) !== null) present.push(e);

  let output!: ReadableStreamDefaultController<Uint8Array>;
  const zip = new Zip((err, chunk, final) => {
    if (err) return output.error(err);
    output.enqueue(chunk);
    if (final) output.close();
  });
  let next = 0;
  let file: ZipPassThrough | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller;
    },
    // Каждый шаг добавляет в архив один кусок: читатель, который не успевает, сам притормаживает чтение с диска
    async pull() {
      if (!file) {
        const entry = present[next++];
        if (!entry) return zip.end();
        file = new ZipPassThrough(entry.path);
        file.mtime = entry.date;
        zip.add(file);
        if ('bytes' in entry) {
          file.push(entry.bytes, true);
          file = null;
          return;
        }
        reader = streamBytes(entry.key).getReader();
      }
      const { value, done } = await reader!.read();
      if (!done) return file.push(value);
      file.push(new Uint8Array(0), true);
      file = null;
      reader = null;
    },
    async cancel() {
      await reader?.cancel();
    },
  });
}
