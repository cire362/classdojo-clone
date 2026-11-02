function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: num('PORT', 3000),
  detectorUrl: process.env.DETECTOR_URL ?? 'http://localhost:8000',
  /** Ставить true, когда сайт открыт по HTTPS */
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  sessionTtlDays: num('SESSION_TTL_DAYS', 30),
  /** Максимальный размер фото для отметки, байт */
  maxPhotoBytes: num('MAX_PHOTO_BYTES', 12 * 1024 * 1024),
  /** Папка тома с загруженными файлами */
  filesDir: process.env.FILES_DIR ?? './data/files',
  /** Максимальный размер одного файла, байт */
  maxFileBytes: num('MAX_FILE_BYTES', 10 * 1024 * 1024),
  /** Сколько файлов может занимать группа вместе с файлами своих учеников, байт */
  groupFilesQuota: num('GROUP_FILES_QUOTA', 500 * 1024 * 1024),
  loginRateLimit: num('LOGIN_RATE_LIMIT', 10),
  /** Пока оплаты нет, премиум бесплатен для всех. PREMIUM_FOR_ALL=false включает обычные правила (срок у преподавателя) */
  premiumForAll: process.env.PREMIUM_FOR_ALL !== 'false',
};
