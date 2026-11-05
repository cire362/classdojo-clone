/**
 * Тип определяется по содержимому: имя и Content-Type задаёт отправитель.
 * SVG и HTML не принимаются никогда: браузер выполнил бы скрипт из них на нашем адресе.
 * WebP не принимается: его нечем пересобрать без метаданных, а браузер и так присылает JPEG.
 */
const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

export function sniffType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  return null;
}
