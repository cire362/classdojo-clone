import { HttpError } from '../../platform/errors.js';

/**
 * Видео MP4 и MOV очищается без перекодирования и без сторонних библиотек: блоки с метаданными
 * (udta, meta, uuid) становятся блоками free того же размера с нулями внутри, а время создания в
 * mvhd, tkhd и mdhd обнуляется. Размеры и смещения не меняются, поэтому ссылки на кадры в stco
 * остаются верными. Так уходят геопозиция (loci, ©xyz, ISO6709), модель телефона, даты и XMP.
 */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'edts', 'dinf', 'stbl']);
const METADATA = new Set(['udta', 'meta', 'uuid']);
const TIMES = new Set(['mvhd', 'tkhd', 'mdhd']);
const FREE = new TextEncoder().encode('free');
const MAX_DEPTH = 8;

const unreadable = () => new HttpError(415, 'Не удалось прочитать видео. Подходят MP4 и MOV');

const typeAt = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

/** MP4 и MOV начинаются с блока ftyp; отдаются как video/mp4 — так их воспроизводят и браузеры не Apple */
export const isVideo = (bytes: Uint8Array) => bytes.length >= 12 && typeAt(bytes, 4) === 'ftyp';

/** Время создания и изменения: у версии 1 по 8 байт, у версии 0 по 4, сразу после версии и флагов */
function clearTimes(bytes: Uint8Array, at: number, length: number) {
  const span = bytes[at] === 1 ? 16 : 8;
  if (length < 4 + span) throw unreadable();
  bytes.fill(0, at + 4, at + 4 + span);
}

export function stripVideoMetadata(source: Uint8Array): Uint8Array {
  const bytes = Uint8Array.from(source);
  const view = new DataView(bytes.buffer);
  let hasMovie = false;

  function walk(start: number, end: number, depth: number) {
    for (let at = start; at < end; ) {
      if (end - at < 8) throw unreadable();
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (end - at < 16) throw unreadable();
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) {
        size = end - at;
      }
      if (size < header || at + size > end) throw unreadable();
      const type = typeAt(bytes, at + 4);
      if (type === 'moov') hasMovie = true;
      if (METADATA.has(type)) {
        bytes.set(FREE, at + 4);
        bytes.fill(0, at + header, at + size);
      } else if (TIMES.has(type)) {
        clearTimes(bytes, at + header, size - header);
      } else if (CONTAINERS.has(type) && depth < MAX_DEPTH) {
        walk(at + header, at + size, depth + 1);
      }
      at += size;
    }
  }

  walk(0, bytes.length, 0);
  if (!hasMovie) throw unreadable();
  return bytes;
}
