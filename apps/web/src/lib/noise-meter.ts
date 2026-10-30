export const NOISE_THRESHOLD_KEY = 'heroes:noise-threshold:v1:';
export const DEFAULT_NOISE_THRESHOLD = 60;

export function restoreNoiseThreshold(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 10 && value <= 90 ? value : DEFAULT_NOISE_THRESHOLD;
}

/** Относительный уровень: RMS окна, −60…0 dBFS → 0…100. Это не физические децибелы. */
export function sampleNoiseLevel(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) return 0;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / samples.length);
  return rms > 0 ? Math.max(0, Math.min(100, (20 * Math.log10(rms) + 60) / 60 * 100)) : 0;
}

export function noiseBand(level: number, threshold: number) {
  return level >= threshold ? 'loud' : level >= threshold - 10 ? 'near' : 'quiet';
}

export function microphoneError(error: unknown): string {
  const name = error instanceof Error || (error && typeof error === 'object' && 'name' in error) ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Нет доступа к микрофону. Разрешите его в настройках сайта в браузере и попробуйте снова.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Микрофон не найден. Подключите его и попробуйте снова.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Микрофон занят или недоступен. Закройте использующую его программу и попробуйте снова.';
  return 'Не удалось включить измерение. Проверьте микрофон и попробуйте снова.';
}
