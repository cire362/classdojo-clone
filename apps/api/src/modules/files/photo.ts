import { createJimp } from '@jimp/core';
import jpeg from '@jimp/js-jpeg';
import png from '@jimp/js-png';
import { methods as resize } from '@jimp/plugin-resize';
import { HttpError } from '../../platform/errors.js';

/**
 * Фото пересобирается из пикселей: в новый файл не попадают EXIF, геопозиция, комментарии
 * и всё, что было спрятано в исходном. Поворот из EXIF применяется до этого.
 */
const Jimp = createJimp({ formats: [jpeg, png], plugins: [resize] });

export const PHOTO_SIDE = 2048;
export const PREVIEW_SIDE = 480;
/** Сжатый PNG в пару мегабайт может развернуться в гигабайты: размер в точках проверяется по заголовку */
const MAX_PIXELS = 30_000_000;
const QUALITY = { full: 85, preview: 75 };

export const isPhoto = (mime: string) => mime === 'image/jpeg' || mime === 'image/png';

/** Маркеры SOF: в них записаны размеры JPEG. C4, C8 и CC — другие сегменты */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function imageSize(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png') return bytes.length >= 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (SOF.has(marker)) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    at += 2 + view.getUint16(at + 2);
  }
  return null;
}

type Image = Awaited<ReturnType<typeof Jimp.fromBuffer>>;

function encode(image: Image, mime: string, side: number, quality: number) {
  if (image.width > side || image.height > side) image.scaleToFit({ w: side, h: side });
  return mime === 'image/png' ? image.getBuffer('image/png') : image.getBuffer('image/jpeg', { quality });
}

async function rebuild(bytes: Uint8Array, mime: string) {
  const size = imageSize(bytes, mime);
  if (!size || !size.width || !size.height) throw new HttpError(415, 'Не удалось прочитать фото');
  if (size.width * size.height > MAX_PIXELS) throw new HttpError(413, 'Фото слишком большое: уменьшите его до 30 мегапикселей');
  const image = await Jimp.fromBuffer(Buffer.from(bytes)).catch(() => {
    throw new HttpError(415, 'Не удалось прочитать фото');
  });
  const preview = image.clone();
  return {
    full: await encode(image, mime, PHOTO_SIDE, QUALITY.full),
    preview: await encode(preview, mime, PREVIEW_SIDE, QUALITY.preview),
  };
}

/** По одному фото за раз: несколько больших снимков сразу не заберут всю память сервера */
let queue: Promise<unknown> = Promise.resolve();

export function rebuildPhoto(bytes: Uint8Array, mime: string): Promise<{ full: Buffer; preview: Buffer }> {
  const run = queue.then(() => rebuild(bytes, mime));
  queue = run.catch(() => undefined);
  return run;
}
