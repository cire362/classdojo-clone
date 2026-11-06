/**
 * Рисунок — список штрихов в координатах холста. Так отмена и повтор просто перерисовывают холст,
 * а размер на экране не влияет на картинку: она всегда CANVAS точек, с белым фоном, как лист бумаги.
 */
export const CANVAS = { width: 1200, height: 900 };
/** Предел точек во всём рисунке: дальше телефон начнёт тормозить на перерисовке */
export const MAX_POINTS = 60_000;
const PAPER = '#ffffff';

/** Цвета карандашей: это содержимое рисунка, а не тема интерфейса, поэтому они одинаковы в светлой и тёмной теме */
export const COLORS = [
  ['#1f2933', 'Чёрный'],
  ['#e03131', 'Красный'],
  ['#f76707', 'Оранжевый'],
  ['#fab005', 'Жёлтый'],
  ['#2f9e44', 'Зелёный'],
  ['#1c7ed6', 'Синий'],
  ['#7048e8', 'Фиолетовый'],
  ['#e64980', 'Розовый'],
  ['#8b5a2b', 'Коричневый'],
] as const;

export const SIZES = [
  [6, 'Тонкая'],
  [16, 'Средняя'],
  [36, 'Толстая'],
] as const;

export type Point = [number, number];
/** Ластик рисует цветом бумаги: на белом листе это то же, что стереть */
export type Stroke = { color: string; size: number; erase: boolean; points: Point[] };
/** undone — отменённые штрихи для повтора; новый штрих их сбрасывает */
export type Drawing = { strokes: Stroke[]; undone: Stroke[] };

export const EMPTY: Drawing = { strokes: [], undone: [] };

export const pointCount = (d: Drawing) => d.strokes.reduce((sum, s) => sum + s.points.length, 0);

export function addStroke(d: Drawing, stroke: Stroke): Drawing {
  return { strokes: [...d.strokes, stroke], undone: [] };
}

export function undo(d: Drawing): Drawing {
  if (!d.strokes.length) return d;
  return { strokes: d.strokes.slice(0, -1), undone: [...d.undone, d.strokes[d.strokes.length - 1]] };
}

export function redo(d: Drawing): Drawing {
  if (!d.undone.length) return d;
  return { strokes: [...d.strokes, d.undone[d.undone.length - 1]], undone: d.undone.slice(0, -1) };
}

/** Точка указателя в координатах холста, в пределах листа */
export function toCanvas(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Point {
  const x = ((clientX - rect.left) * CANVAS.width) / rect.width;
  const y = ((clientY - rect.top) * CANVAS.height) / rect.height;
  return [Math.min(CANVAS.width, Math.max(0, x)), Math.min(CANVAS.height, Math.max(0, y))];
}

/** Штрих сглаживается: кривые через середины соседних точек, одна точка — круглая капля */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const color = s.erase ? PAPER : s.color;
  const [first, ...rest] = s.points;
  if (!first) return;
  if (!rest.length) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(first[0], first[1], s.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 0; i < rest.length - 1; i++) {
    const [x, y] = rest[i];
    const [nx, ny] = rest[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const [lx, ly] = rest[rest.length - 1];
  ctx.lineTo(lx, ly);
  ctx.stroke();
}

/** Весь рисунок заново: белый лист и штрихи по порядку */
export function render(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  for (const s of strokes) drawStroke(ctx, s);
}
