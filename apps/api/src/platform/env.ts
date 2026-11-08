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
  /** Максимальный размер видео: его нельзя уменьшить на сервере без перекодирования */
  maxVideoBytes: num('MAX_VIDEO_BYTES', 100 * 1024 * 1024),
  /** Сколько файлов может занимать группа вместе с файлами своих учеников, байт */
  groupFilesQuota: num('GROUP_FILES_QUOTA', 500 * 1024 * 1024),
  /** Сколько дней хранятся фото и файлы группы после переноса в архив; потом удаляются, сама группа остаётся */
  archivedFilesDays: num('ARCHIVED_FILES_DAYS', 365),
  loginRateLimit: num('LOGIN_RATE_LIMIT', 10),
};
