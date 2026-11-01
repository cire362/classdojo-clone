import { useCallback, useEffect, useState } from 'react';
import { TIMER_KEY, idleTimer, pauseTimer, remainingTime, restoreTimer, resumeTimer, startTimer, type TimerState } from '../lesson-timer';

/** Компонент с этим хуком монтируется с key=groupId: каждый урок восстанавливает свой отсчёт. */
export function useLessonTimer(groupId: string, storageKey = TIMER_KEY) {
  const key = storageKey + groupId;
  const [timer, setTimer] = useState<TimerState>(() => {
    try { return restoreTimer(sessionStorage.getItem(key), Date.now()); }
    catch { return idleTimer(); }
  });
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(timer)); }
    catch { /* Без хранилища таймер работает до закрытия страницы. */ }
  }, [key, timer]);

  useEffect(() => {
    if (timer.status !== 'running') return;
    const update = () => {
      const at = Date.now();
      setNow(at);
      if (remainingTime(timer, at) === 0) {
        setTimer((current) => current.status === 'running' && current.endsAt === timer.endsAt
          ? { ...current, status: 'finished', remainingMs: 0, endsAt: null } : current);
      }
    };
    update();
    const tick = window.setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [timer.status, timer.endsAt]);

  const configure = useCallback((duration: number) => setTimer(idleTimer(duration)), []);
  const start = useCallback((duration: number) => { const at = Date.now(); setNow(at); setTimer(startTimer(duration, at)); }, []);
  const pause = useCallback(() => { const at = Date.now(); setNow(at); setTimer((current) => pauseTimer(current, at)); }, []);
  const resume = useCallback(() => { const at = Date.now(); setNow(at); setTimer((current) => resumeTimer(current, at)); }, []);
  const reset = useCallback(() => setTimer((current) => idleTimer(current.durationMs)), []);
  return { timer, remaining: remainingTime(timer, now), configure, start, pause, resume, reset };
}
