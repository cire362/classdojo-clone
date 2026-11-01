import { useEffect, useState } from 'react';
import { Skeleton } from '../../../ui';

const QUIET_ZONE = 4;

/** Рисунок QR-кода. Библиотека грузится только там, где код показывают, и в ядро не попадает. */
export function QrImage({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const [matrix, setMatrix] = useState<boolean[][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    import('qrcode-generator')
      .then(({ default: qrcode }) => {
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();
        const size = qr.getModuleCount();
        const rows = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => qr.isDark(y, x)));
        if (current) setMatrix(rows);
      })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [value]);

  if (failed) return <p role="alert" className="text-sm text-minus">Не удалось показать QR-код. Обновите страницу.</p>;
  if (!matrix) return <Skeleton className={`aspect-square ${className}`} />;
  const size = matrix.length + QUIET_ZONE * 2;
  const path = matrix
    .flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`] : [])))
    .join('');
  // Белый фон и в тёмной теме: иначе камера не прочитает код
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className={`bg-white ${className}`}>
      <path d={path} fill="#000" />
    </svg>
  );
}
