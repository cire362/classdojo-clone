import { useEffect, useState } from 'react';

/** Режим проектора: полноэкранный, Esc — выход */
export function useProjector() {
  const [projector, setProjector] = useState(false);
  useEffect(() => {
    if (!projector) return;
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProjector(false);
    const onFs = () => !document.fullscreenElement && setProjector(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [projector]);
  return [projector, setProjector] as const;
}
