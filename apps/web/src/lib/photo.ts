/**
 * Уменьшаем фото в браузере: быстрее загрузка с телефона, учитывается поворот
 * из EXIF, а сами EXIF-метаданные (геолокация и т.п.) не уходят на сервер.
 * Сервер всё равно пересобирает фото сам: запрос мог прийти не из браузера.
 */
export async function prepareImage(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', 0.88),
  );
}
