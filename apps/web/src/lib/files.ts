/** Адрес загруженного файла: права проверяет сервер при каждом показе */
export const fileUrl = (id: string, preview = false) => `/api/files/${id}${preview ? '?size=preview' : ''}`;
