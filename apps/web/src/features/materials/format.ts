import type { MaterialKind } from '../../lib/api';

export const KIND_LABEL: Record<MaterialKind, string> = {
  pdf: 'PDF',
  word: 'Текст',
  excel: 'Таблица',
  powerpoint: 'Презентация',
  image: 'Картинка',
  text: 'Текстовый файл',
};

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}
