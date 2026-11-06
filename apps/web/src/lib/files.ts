/** Адрес загруженного файла: права проверяет сервер при каждом показе */
export const fileUrl = (id: string, preview = false) => `/api/files/${id}${preview ? '?size=preview' : ''}`;

/** Архив ZIP скачивается обычной ссылкой: права проверяет сервер. path — кабинет роли, например /teacher/groups/g1 */
export const exportUrl = (path: string) => `/api${path}/export`;

/** «6 ноября 2027»: дата удаления файлов архивной группы */
export const longDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

/** Размер для подписи файла: «340 КБ», «1,2 МБ» */
export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
}
