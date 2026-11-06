import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowClockwiseIcon, ArrowCounterClockwiseIcon, EraserIcon, TrashIcon } from '@phosphor-icons/react';
import { markPrepared } from '../../../lib/attachments';
import { useToast } from '../../../ui/Toast';
import {
  CANVAS, COLORS, EMPTY, MAX_POINTS, SIZES, addStroke, drawStroke, pointCount, redo, render, toCanvas, undo,
  type Drawing, type Stroke,
} from '../drawing';

/**
 * Холст для младших классов: пальцем, стилусом или мышью. Рисунок хранит форма, поэтому закрытое окно его не теряет.
 * «Готово» отдаёт PNG в точный размер CANVAS на белом фоне: его не пережимают в JPEG, линии остаются чёткими.
 */
export function DrawingPad({ drawing, onChange, onDone }: {
  drawing: Drawing;
  onChange: (drawing: Drawing) => void;
  onDone: (file: File) => void;
}) {
  const toast = useToast();
  const canvas = useRef<HTMLCanvasElement>(null);
  // Штрих, который рисуется сейчас: в состояние он попадает, когда палец отпустили
  const current = useRef<{ pointer: number; stroke: Stroke } | null>(null);
  const [color, setColor] = useState<string>(COLORS[0][0]);
  const [size, setSize] = useState<number>(SIZES[1][0]);
  const [erase, setErase] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const context = () => canvas.current?.getContext('2d') ?? null;
  const full = pointCount(drawing) >= MAX_POINTS;

  useEffect(() => {
    const ctx = context();
    if (ctx) render(ctx, drawing.strokes);
  }, [drawing.strokes]);

  function down(e: PointerEvent<HTMLCanvasElement>) {
    // Второй палец не начинает новый штрих поверх первого
    if (current.current || full) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const stroke: Stroke = { color, size, erase, points: [toCanvas(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())] };
    current.current = { pointer: e.pointerId, stroke };
    const ctx = context();
    if (ctx) drawStroke(ctx, stroke);
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    const active = current.current;
    if (!active || active.pointer !== e.pointerId) return;
    const point = toCanvas(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
    const points = active.stroke.points;
    const last = points[points.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 2) return;
    points.push(point);
    // Пока палец движется, дорисовываем только последний отрезок; сглаженный штрих появится после отпускания
    const ctx = context();
    if (ctx) drawStroke(ctx, { ...active.stroke, points: [last, point] });
  }

  function up(e: PointerEvent<HTMLCanvasElement>) {
    const active = current.current;
    if (!active || active.pointer !== e.pointerId) return;
    current.current = null;
    setConfirmClear(false);
    onChange(addStroke(drawing, active.stroke));
  }

  async function done() {
    const ctx = context();
    if (!ctx || !canvas.current) return;
    setBusy(true);
    render(ctx, drawing.strokes);
    const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, 'image/png'));
    setBusy(false);
    if (!blob) return toast({ text: 'Не удалось сохранить рисунок, попробуйте ещё раз', tone: 'error' });
    onDone(markPrepared(new File([blob], 'рисунок.png', { type: 'image/png' })));
  }

  const choose = (value: string) => {
    setColor(value);
    setErase(false);
  };
  const tool = (on: boolean) =>
    `flex size-11 items-center justify-center rounded-xl ${on ? 'bg-accent/30 ring-2 ring-ink' : 'bg-surface-2'}`;

  return (
    <div className="space-y-3">
      <canvas
        ref={canvas}
        width={CANVAS.width}
        height={CANVAS.height}
        role="img"
        aria-label="Лист для рисования: рисуйте пальцем, стилусом или мышью"
        className="aspect-[4/3] w-full cursor-crosshair touch-none rounded-xl border border-line bg-white"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {full && <p className="text-sm text-minus">Лист заполнен: отмените часть штрихов или нажмите «Готово».</p>}
      <fieldset>
        <legend className="label">Цвет</legend>
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map(([value, name]) => (
            <button
              key={value}
              type="button"
              className={tool(!erase && color === value)}
              aria-label={name}
              aria-pressed={!erase && color === value}
              onClick={() => choose(value)}
            >
              <span className="size-6 rounded-full ring-2 ring-ink/30" style={{ background: value }} aria-hidden />
            </button>
          ))}
          <button type="button" className={tool(erase)} aria-label="Ластик" aria-pressed={erase} onClick={() => setErase(!erase)}>
            <EraserIcon size={22} aria-hidden />
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Толщина</legend>
        <div className="flex flex-wrap gap-1.5">
          {SIZES.map(([value, name]) => (
            <button
              key={value}
              type="button"
              className={tool(size === value)}
              aria-label={name}
              aria-pressed={size === value}
              onClick={() => setSize(value)}
            >
              <span className="rounded-full bg-ink" style={{ width: value / 2 + 2, height: value / 2 + 2 }} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!drawing.strokes.length}
          onClick={() => onChange(undo(drawing))}
        >
          <ArrowCounterClockwiseIcon size={18} aria-hidden /> Отменить
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!drawing.undone.length}
          onClick={() => onChange(redo(drawing))}
        >
          <ArrowClockwiseIcon size={18} aria-hidden /> Вернуть
        </button>
        {confirmClear ? (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              onChange(EMPTY);
              setConfirmClear(false);
            }}
          >
            Точно очистить
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" disabled={!drawing.strokes.length} onClick={() => setConfirmClear(true)}>
            <TrashIcon size={18} aria-hidden /> Очистить
          </button>
        )}
      </div>
      <button type="button" className="btn btn-primary" disabled={busy || !drawing.strokes.length} onClick={() => void done()}>
        Готово: приложить к работе
      </button>
    </div>
  );
}
