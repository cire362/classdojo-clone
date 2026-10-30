import { useCallback, useEffect, useRef, useState } from 'react';
import { microphoneError, NOISE_THRESHOLD_KEY, restoreNoiseThreshold, sampleNoiseLevel } from './noise-meter';

interface Resources {
  stream: MediaStream;
  context?: AudioContext;
  source?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
  samples?: Float32Array<ArrayBuffer>;
  timer?: number;
  dispose: (() => void)[];
}

/** Один локальный микрофон; подключение к динамикам, запись и сетевые запросы отсутствуют. */
export function useNoiseMeter(groupId: string) {
  const [phase, setPhase] = useState<'off' | 'starting' | 'active' | 'error'>('off');
  const [level, setLevel] = useState(0);
  const [message, setMessage] = useState('');
  const [threshold, setThreshold] = useState(() => {
    try { return restoreNoiseThreshold(localStorage.getItem(NOISE_THRESHOLD_KEY + groupId)); }
    catch { return restoreNoiseThreshold(null); }
  });
  const resources = useRef<Resources | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);

  const release = useCallback(() => {
    const r = resources.current;
    resources.current = null;
    if (!r) return;
    r.dispose.forEach((fn) => fn());
    if (r.timer !== undefined) window.clearInterval(r.timer);
    r.samples?.fill(0);
    r.stream.getTracks().forEach((t) => t.stop());
    try { r.source?.disconnect(); r.analyser?.disconnect(); } catch { /* уже отсоединён */ }
    try { if (r.context && r.context.state !== 'closed') void r.context.close().catch(() => undefined); } catch { /* уже закрыт */ }
  }, []);

  const stop = useCallback((note = '') => {
    generation.current++;
    pending.current = false;
    release();
    setPhase('off'); setLevel(0); setMessage(note);
  }, [release]);

  async function start() {
    if (pending.current || resources.current) return;
    const request = ++generation.current;
    pending.current = true;
    setPhase('starting'); setMessage(''); setLevel(0);
    const fail = (message: string) => {
      if (generation.current !== request) return;
      generation.current++; pending.current = false;
      release(); setPhase('error'); setLevel(0); setMessage(message);
    };
    if (window.isSecureContext === false) {
      fail('Браузер разрешает микрофон только на HTTPS или localhost. Откройте приложение по защищённому адресу или на этом компьютере через localhost.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      fail('Этот браузер не поддерживает шумомер. Откройте приложение в браузере с доступом к микрофону.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (generation.current !== request) { stream.getTracks().forEach((t) => t.stop()); return; }
      const r: Resources = { stream, dispose: [] };
      resources.current = r;
      const tracks = stream.getAudioTracks();
      if (!tracks.length || tracks.some((t) => t.readyState === 'ended' || t.muted)) { fail('Микрофон отключён или не передаёт звук. Проверьте его и включите измерение снова.'); return; }
      const ended = () => fail('Микрофон отключён или доступ отозван. Проверьте его и включите измерение снова.');
      for (const track of tracks) {
        track.addEventListener('ended', ended); track.addEventListener('mute', ended);
        r.dispose.push(() => { track.removeEventListener('ended', ended); track.removeEventListener('mute', ended); });
      }
      const context = r.context = new AudioContext();
      await context.resume();
      if (generation.current !== request) return;
      if (context.state !== 'running') { fail('Браузер приостановил измерение. Включите микрофон снова.'); return; }
      const changed = () => { if (context.state !== 'running') fail('Браузер приостановил измерение. Включите микрофон снова.'); };
      context.addEventListener('statechange', changed);
      r.dispose.push(() => context.removeEventListener('statechange', changed));
      const analyser = r.analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      r.source = context.createMediaStreamSource(stream);
      r.source.connect(analyser);
      const samples = r.samples = new Float32Array(analyser.fftSize);
      let smoothed = 0;
      pending.current = false;
      setPhase('active');
      r.timer = window.setInterval(() => {
        if (generation.current !== request) return;
        try {
          analyser.getFloatTimeDomainData(samples);
          smoothed += (sampleNoiseLevel(samples) - smoothed) * 0.35;
          setLevel(Math.round(smoothed));
        } catch { fail('Измерение прервалось. Проверьте микрофон и включите его снова.'); }
      }, 100);
    } catch (e) { fail(microphoneError(e)); }
  }

  useEffect(() => {
    const hide = () => { if (pending.current || resources.current) stop('Измерение остановлено при уходе со вкладки. Включите микрофон, чтобы продолжить.'); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') hide(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', hide);
      generation.current++; pending.current = false; release();
    };
  }, [release, stop]);

  function changeThreshold(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.max(10, Math.min(90, Math.round(value)));
    setThreshold(next);
    try { localStorage.setItem(NOISE_THRESHOLD_KEY + groupId, String(next)); } catch { /* работает без сохранения */ }
  }
  return { phase, level, message, threshold, changeThreshold, start, stop };
}
