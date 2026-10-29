/** Локальный таймер группы: момент окончания сохраняется только в текущей вкладке. */
export const TIMER_DEFAULT_MS = 5 * 60_000;
export const TIMER_MAX_MS = (99 * 60 + 59) * 1000;
export const TIMER_KEY = 'heroes:lesson-timer:v1:';

export interface TimerState {
  version: 1;
  status: 'idle' | 'running' | 'paused' | 'finished';
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
}

export function idleTimer(durationMs = TIMER_DEFAULT_MS): TimerState {
  return { version: 1, status: 'idle', durationMs, remainingMs: durationMs, endsAt: null };
}

export function remainingTime(timer: TimerState, now: number): number {
  return timer.status === 'running' ? Math.max(0, timer.endsAt! - now) : timer.remainingMs;
}

export function startTimer(durationMs: number, now: number): TimerState {
  return { ...idleTimer(durationMs), status: 'running', endsAt: now + durationMs };
}

export function pauseTimer(timer: TimerState, now: number): TimerState {
  if (timer.status !== 'running') return timer;
  const remainingMs = remainingTime(timer, now);
  return { ...timer, status: remainingMs ? 'paused' : 'finished', remainingMs, endsAt: null };
}

export function resumeTimer(timer: TimerState, now: number): TimerState {
  return timer.status === 'paused' ? { ...timer, status: 'running', endsAt: now + timer.remainingMs } : timer;
}

export function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function timerDuration(minutes: string, seconds: string): number | null {
  if (!/^\d{0,2}$/.test(minutes) || !/^\d{0,2}$/.test(seconds)) return null;
  const m = Number(minutes);
  const s = Number(seconds);
  const ms = (m * 60 + s) * 1000;
  return s < 60 && ms >= 1000 && ms <= TIMER_MAX_MS ? ms : null;
}

export function restoreTimer(raw: string | null, now: number): TimerState {
  try {
    const t = JSON.parse(raw ?? 'null') as TimerState | null;
    if (!t || t.version !== 1 || !['idle', 'running', 'paused', 'finished'].includes(t.status)
      || !Number.isSafeInteger(t.durationMs) || t.durationMs % 1000 !== 0 || t.durationMs < 1000 || t.durationMs > TIMER_MAX_MS
      || !Number.isSafeInteger(t.remainingMs) || t.remainingMs < 0 || t.remainingMs > t.durationMs) return idleTimer();
    if (t.status === 'running') {
      if (!Number.isSafeInteger(t.endsAt) || t.endsAt! <= 0 || t.endsAt! > now + t.durationMs || !t.remainingMs) return idleTimer();
      if (t.endsAt! <= now) return { ...t, status: 'finished', remainingMs: 0, endsAt: null };
    } else if (t.endsAt !== null || (t.status === 'idle' && t.remainingMs !== t.durationMs)
      || (t.status === 'paused' && !t.remainingMs) || (t.status === 'finished' && t.remainingMs !== 0)) return idleTimer();
    return { version: 1, status: t.status, durationMs: t.durationMs, remainingMs: t.remainingMs, endsAt: t.endsAt };
  } catch {
    return idleTimer();
  }
}
