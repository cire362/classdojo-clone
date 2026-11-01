import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimerState } from '../lesson-timer';

const UNAVAILABLE = 'Звук недоступен. Таймер продолжает работать.';

/** Сигнал по окончании отсчёта. Браузер разрешает звук только после действия пользователя, поэтому он включается явно. */
export function useTimerSound(status: TimerState['status']) {
  const [sound, setSound] = useState(false);
  const [soundError, setSoundError] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const soundRequest = useRef(0);
  const previousStatus = useRef(status);

  const enableSound = useCallback(async () => {
    const request = ++soundRequest.current;
    try {
      if (typeof AudioContext === 'undefined') throw new Error();
      const ctx = audio.current ??= new AudioContext();
      await ctx.resume();
      if (ctx.state !== 'running') throw new Error();
      if (request === soundRequest.current) { setSoundError(''); setSound(true); }
    } catch {
      if (request === soundRequest.current) { setSound(false); setSoundError(UNAVAILABLE); }
    }
  }, []);

  const disableSound = useCallback(() => {
    soundRequest.current++;
    setSound(false);
    setSoundError('');
  }, []);

  useEffect(() => () => { soundRequest.current++; void audio.current?.close().catch(() => undefined); }, []);
  useEffect(() => {
    if (status === 'finished' && previousStatus.current === 'running' && sound) {
      try {
        const ctx = audio.current;
        if (!ctx || ctx.state !== 'running') throw new Error();
        // Два коротких негромких сигнала, без загружаемых звуковых файлов.
        for (let i = 0; i < 2; i++) {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const at = ctx.currentTime + i * 0.35;
          oscillator.type = 'sine';
          oscillator.frequency.value = i ? 880 : 660;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.linearRampToValueAtTime(0.08, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
          oscillator.connect(gain); gain.connect(ctx.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(at); oscillator.stop(at + 0.28);
        }
      } catch { setSound(false); setSoundError(UNAVAILABLE); }
    }
    previousStatus.current = status;
  }, [status, sound]);

  return { sound, soundError, enableSound, disableSound };
}
