import type { MaterialKind } from '@heroes/shared/api';

/**
 * Формат методички определяется по содержимому, а не по имени: имя задаёт отправитель.
 * HTML, SVG и исполняемые файлы не принимаются никогда. Word, Excel, PowerPoint и OpenDocument показываются
 * через PDF, который делает сервис просмотра; PDF, картинки и текст браузер показывает сам.
 */
export interface Format {
  kind: MaterialKind;
  mime: string;
  /** Расширение для сервиса просмотра; null — браузер покажет файл сам */
  convert: string | null;
}

const starts = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(text);

const OOXML: [string, Format][] = [
  ['word/', { kind: 'word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', convert: 'docx' }],
  ['xl/', { kind: 'excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', convert: 'xlsx' }],
  ['ppt/', { kind: 'powerpoint', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', convert: 'pptx' }],
];
const ODF: [string, Format][] = [
  ['application/vnd.oasis.opendocument.text', { kind: 'word', mime: 'application/vnd.oasis.opendocument.text', convert: 'odt' }],
  ['application/vnd.oasis.opendocument.spreadsheet', {
    kind: 'excel', mime: 'application/vnd.oasis.opendocument.spreadsheet', convert: 'ods',
  }],
  ['application/vnd.oasis.opendocument.presentation', {
    kind: 'powerpoint', mime: 'application/vnd.oasis.opendocument.presentation', convert: 'odp',
  }],
];
/** Старые форматы Office (контейнер OLE) различаются только расширением */
const LEGACY: Record<string, Format> = {
  doc: { kind: 'word', mime: 'application/msword', convert: 'doc' },
  xls: { kind: 'excel', mime: 'application/vnd.ms-excel', convert: 'xls' },
  ppt: { kind: 'powerpoint', mime: 'application/vnd.ms-powerpoint', convert: 'ppt' },
};

function isText(bytes: Uint8Array) {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function detectFormat(bytes: Uint8Array, filename: string): Format | null {
  const extension = filename.toLowerCase().split('.').pop() ?? '';
  if (starts(bytes, ascii('%PDF-'))) return { kind: 'pdf', mime: 'application/pdf', convert: null };
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg', convert: null };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47])) return { kind: 'image', mime: 'image/png', convert: null };
  if (starts(bytes, ascii('{\\rtf'))) return { kind: 'word', mime: 'application/rtf', convert: 'rtf' };
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // В начале архива OpenDocument лежит файл mimetype с типом документа
    const odf = ODF.find(([type]) => has(bytes.subarray(0, 200), type));
    if (odf) return odf[1];
    if (has(bytes, '[Content_Types].xml')) return OOXML.find(([folder]) => has(bytes, folder))?.[1] ?? null;
    return null;
  }
  if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return LEGACY[extension] ?? null;
  if (['txt', 'md', 'csv'].includes(extension) && isText(bytes)) return { kind: 'text', mime: 'text/plain; charset=utf-8', convert: null };
  return null;
}
