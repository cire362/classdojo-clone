import { crc32 } from 'node:zlib';
import { createJimp } from '@jimp/core';
import jpeg from '@jimp/js-jpeg';
import png from '@jimp/js-png';

/** Картинки для тестов собираются на лету: так в репозитории нет файлов с чужими метаданными */
const Jimp = createJimp({ formats: [jpeg, png] });

export async function picture(width: number, height: number, mime: 'image/png' | 'image/jpeg') {
  const image = new Jimp({ width, height, color: 0x3366ccff });
  return mime === 'image/png' ? image.getBuffer('image/png') : image.getBuffer('image/jpeg');
}

export async function sizeOf(bytes: ArrayBuffer | Uint8Array) {
  const image = await Jimp.fromBuffer(Buffer.from(bytes as ArrayBuffer));
  return { width: image.width, height: image.height };
}

const segment = (marker: number, payload: Buffer) => {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
};

/** EXIF с поворотом и подписью в ImageDescription, плюс комментарий JPEG: оба несут secret */
export function withExif(jpegBytes: Buffer, orientation: number, secret: string) {
  const text = Buffer.from(`${secret}\0`);
  const entries = 2;
  const dataAt = 8 + 2 + entries * 12 + 4;
  const tiff = Buffer.alloc(dataAt + text.length);
  tiff.write('II', 0);
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(entries, 8);
  // ImageDescription (ASCII) — теги идут по возрастанию номера
  tiff.writeUInt16LE(0x010e, 10);
  tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(text.length, 14);
  tiff.writeUInt32LE(dataAt, 18);
  // Orientation (SHORT)
  tiff.writeUInt16LE(0x0112, 22);
  tiff.writeUInt16LE(3, 24);
  tiff.writeUInt32LE(1, 26);
  tiff.writeUInt16LE(orientation, 30);
  text.copy(tiff, dataAt);
  const exif = segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff]));
  const comment = segment(0xfe, Buffer.from(secret));
  return Buffer.concat([jpegBytes.subarray(0, 2), exif, comment, jpegBytes.subarray(2)]);
}

/** Текстовый блок PNG сразу после заголовка IHDR */
export function withPngText(pngBytes: Buffer, secret: string) {
  const body = Buffer.concat([Buffer.from('tEXt'), Buffer.from('Comment\0'), Buffer.from(secret)]);
  const chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(body.length - 4, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), body.length + 4);
  return Buffer.concat([pngBytes.subarray(0, 33), chunk, pngBytes.subarray(33)]);
}

/** Только заголовок PNG с огромными размерами: пиксели распаковывать нельзя */
export function pngBomb(width: number, height: number) {
  const bytes = Buffer.from(pngHeader);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

const pngHeader = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
