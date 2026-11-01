import { TRACKS, midiToHz, volumeGain, type Track } from './music';

const FADE_SECONDS = 1.5;
/** С запасом: браузер редко будит таймеры скрытой вкладки, а музыка не должна прерваться */
const LOOKAHEAD_SECONDS = 75;
const REFILL_MS = 5000;
const NOTE_LEVEL = 0.1;

export interface MusicPlayer {
  setVolume: (volume: number) => void;
  stop: () => void;
}

/** Один аккорд плавно входит поверх затухающего предыдущего */
function playChord(ctx: BaseAudioContext, output: AudioNode, notes: readonly number[], at: number, seconds: number) {
  const overlap = seconds * 0.35;
  for (const note of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = midiToHz(note);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(NOTE_LEVEL, at + overlap);
    gain.gain.setValueAtTime(NOTE_LEVEL, at + seconds);
    gain.gain.linearRampToValueAtTime(0, at + seconds + overlap);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(at);
    oscillator.stop(at + seconds + overlap);
  }
}

/** Шум сквозь мягкий фильтр звучит как дождь за окном */
function playNoise(ctx: BaseAudioContext, output: AudioNode, level: number) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  gain.gain.value = level;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start();
}

/** Звук дорожки в выбранный выход. Отдельно от запуска: годится и для OfflineAudioContext */
export function connectTrack(ctx: BaseAudioContext, output: AudioNode, track: Track) {
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 800;
  tone.connect(output);
  if (track.noise) playNoise(ctx, output, track.noise);
  let index = 0;
  let nextAt = ctx.currentTime + 0.05;
  return function fill(until: number) {
    while (nextAt < until) {
      playChord(ctx, tone, track.chords[index % track.chords.length], nextAt, track.chordSeconds);
      nextAt += track.chordSeconds;
      index++;
    }
  };
}

export async function startMusic(trackId: Track['id'], volume: number): Promise<MusicPlayer> {
  if (typeof AudioContext === 'undefined') throw new Error('Нет Web Audio');
  const track = TRACKS.find((t) => t.id === trackId)!;
  const ctx = new AudioContext();
  try {
    await ctx.resume();
    if (ctx.state !== 'running') throw new Error('Браузер не разрешил звук');
  } catch (e) {
    void ctx.close().catch(() => undefined);
    throw e;
  }
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(volumeGain(volume), ctx.currentTime + FADE_SECONDS);
  master.connect(ctx.destination);
  const fill = connectTrack(ctx, master, track);
  const refill = () => fill(ctx.currentTime + LOOKAHEAD_SECONDS);
  refill();
  const timer = window.setInterval(refill, REFILL_MS);

  return {
    setVolume(next) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(volumeGain(next), ctx.currentTime, 0.05);
    },
    stop() {
      window.clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, FADE_SECONDS / 4);
      window.setTimeout(() => void ctx.close().catch(() => undefined), FADE_SECONDS * 1000);
    },
  };
}
