import { prepareImage } from './photo';

/** Как на сервере: до пяти файлов к сообщению или работе, PDF до 10 МБ. Фото браузер уменьшает сам, поэтому их размер не важен */
export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_MB = 10;
const PHOTO_SIDE = 2048;

export const isPhotoFile = (file: File) => file.type.startsWith('image/');
const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

/** Причина, по которой файл нельзя приложить, или null */
export function rejectReason(file: File) {
  if (!isPhotoFile(file) && !isPdf(file)) return `${file.name}: подходят только фото и PDF`;
  if (isPdf(file) && file.size > MAX_FILE_MB * 1024 * 1024) return `${file.name}: файл больше ${MAX_FILE_MB} МБ`;
  return null;
}

/**
 * Фото уходят уменьшенными JPEG без метаданных, PDF — как есть. По одному: несколько больших снимков сразу
 * заняли бы много памяти телефона. Имя фото сохраняется, меняется только расширение.
 */
export async function prepareAttachments(files: File[]) {
  const ready: File[] = [];
  for (const file of files) {
    if (!isPhotoFile(file)) ready.push(file);
    else {
      const name = `${file.name.replace(/\.[^.]+$/, '') || 'фото'}.jpg`;
      ready.push(new File([await prepareImage(file, PHOTO_SIDE)], name, { type: 'image/jpeg' }));
    }
  }
  return ready;
}
