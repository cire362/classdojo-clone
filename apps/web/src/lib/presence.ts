import { useEffect, useState } from 'react';

/**
 * Появление и исчезновение на CSS-анимациях (без библиотеки анимаций на критическом пути).
 * Элемент монтируется сразу при open и получает анимацию входа; при закрытии ещё exitMs
 * остаётся в DOM с флагом closing — на это время ему ставится анимация выхода.
 */
export const presenceConfig = { skipExit: false };

export function exitDelay(ms: number): number {
  return presenceConfig.skipExit ? 0 : ms;
}

export function usePresence(open: boolean, exitMs = 200): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const t = window.setTimeout(() => setMounted(false), exitDelay(exitMs));
    return () => window.clearTimeout(t);
  }, [open, mounted, exitMs]);

  return { mounted: open || mounted, closing: !open && mounted };
}
