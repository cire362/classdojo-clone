/** Настройки музыки урока: удобство одного браузера, поэтому localStorage */
export const MUSIC_KEY = 'heroes:lesson-music:v1';
export const DEFAULT_VOLUME = 50;

/** Мелодии не загружаются, а создаются в браузере из аккордов: своя музыка без файлов и чужих лицензий. */
export const TRACKS = [
  {
    id: 'morning',
    title: 'Тихое утро',
    chordSeconds: 9,
    noise: 0,
    chords: [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]],
  },
  {
    id: 'focus',
    title: 'Сосредоточение',
    chordSeconds: 12,
    noise: 0,
    chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]],
  },
  {
    id: 'rain',
    title: 'Дождь за окном',
    chordSeconds: 14,
    noise: 0.5,
    chords: [[40, 47, 55, 59], [36, 43, 52, 55], [38, 45, 54, 57], [43, 50, 55, 59]],
  },
] as const;

export type Track = (typeof TRACKS)[number];

export interface MusicSettings {
  trackId: Track['id'];
  volume: number;
}

export const defaultMusic = (): MusicSettings => ({ trackId: TRACKS[0].id, volume: DEFAULT_VOLUME });

export function restoreMusic(raw: string | null): MusicSettings {
  try {
    const s = JSON.parse(raw ?? 'null') as MusicSettings | null;
    if (!s || !TRACKS.some((t) => t.id === s.trackId)) return defaultMusic();
    if (!Number.isInteger(s.volume) || s.volume < 0 || s.volume > 100) return defaultMusic();
    return { trackId: s.trackId, volume: s.volume };
  } catch {
    return defaultMusic();
  }
}

export const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Слух воспринимает громкость нелинейно. Замер в браузере: на максимуме пик 0,72, искажений нет */
export const volumeGain = (volume: number) => (volume / 100) ** 2;
