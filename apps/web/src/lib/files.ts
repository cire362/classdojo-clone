/** Адрес загруженного файла: права проверяет сервер при каждом показе */
export const fileUrl = (id: string, preview = false) => `/api/files/${id}${preview ? '?size=preview' : ''}`;

/** Размер для подписи файла: «340 КБ», «1,2 МБ» */
export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
}
