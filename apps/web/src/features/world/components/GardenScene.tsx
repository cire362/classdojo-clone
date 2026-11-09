/**
 * Рисунок карты Сада маяков 640×340: берег, ручей, холмы и у каждого места свой ориентир — причал, мост,
 * мельница, арка, обсерватория и маяк. Восстановленное место светится. Метки мест — HTML-кнопки поверх
 * рисунка (WorldMap), здесь только картинка.
 */
export const MAP_W = 640;
export const MAP_H = 340;
/** Метки мест на тропе по порядку; ориентир стоит рядом с меткой */
export const PLACES: [number, number][] = [[98, 262], [176, 212], [128, 122], [318, 140], [452, 112], [548, 238]];

/** Тропа через метки from..to: кривая Катмулла — Рома, переведённая в кубические Безье */
export function trail(points: [number, number][], from: number, to: number) {
  let d = `M${points[from][0]} ${points[from][1]}`;
  for (let i = from; i < to; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(i - 1, 0)], points[i], points[i + 1], points[Math.min(i + 2, points.length - 1)]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const LINE = { stroke: 'var(--ink)', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const TREES: [number, number, number][] = [
  [30, 84, 11], [52, 104, 8], [104, 40, 10], [250, 58, 12], [282, 82, 9], [384, 52, 10], [402, 196, 11],
  [338, 232, 9], [494, 172, 10], [612, 118, 12], [596, 64, 9], [270, 250, 8], [36, 176, 10],
];
const STARS: [number, number][] = [[404, 30], [430, 18], [486, 26], [512, 44], [470, 50]];

function Lamp({ x, y, r = 4.5, lit }: { x: number; y: number; r?: number; lit: boolean }) {
  return (
    <>
      {lit && <circle cx={x} cy={y} r={r * 4.5} fill="url(#garden-glow)" />}
      <circle cx={x} cy={y} r={r} fill={lit ? 'var(--accent)' : 'var(--map-rock)'} {...LINE} />
    </>
  );
}

function Pier({ lit }: { lit: boolean }) {
  return (
    <>
      <path d="M-24 -9 V3 M-42 -9 V4 M-60 -9 V5" {...LINE} />
      <path d="M-72 -14 H-14 V-9 H-72Z" fill="var(--map-wood)" {...LINE} />
      <path d="M-94 2 H-66 L-71 10 H-89Z" fill="var(--surface)" {...LINE} />
      <path d="M-80 2 V-18 L-70 0" fill="none" {...LINE} />
      <path d="M-22 -14 V-44 H-16" fill="none" {...LINE} strokeWidth={2} />
      <Lamp x={-16} y={-40} lit={lit} />
    </>
  );
}

function Bridge({ lit }: { lit: boolean }) {
  return (
    <>
      <path d="M8 -16 Q36 -42 64 -16 L64 -11 Q36 -36 8 -11Z" fill="var(--map-wood)" {...LINE} />
      <path d="M8 -16 Q36 -42 64 -16 M18 -22 V-30 M36 -29 V-37 M54 -22 V-30 M14 -26 Q36 -50 58 -26" fill="none" {...LINE} />
      <path d="M66 -14 V-46" {...LINE} strokeWidth={2} />
      <Lamp x={66} y={-50} lit={lit} />
    </>
  );
}

function Windmill({ lit }: { lit: boolean }) {
  return (
    <>
      <path d="M-12 -18 L-8 -56 H8 L12 -18Z" fill="var(--surface)" {...LINE} />
      <path d="M-10 -56 Q0 -67 10 -56Z" fill="var(--map-wood)" {...LINE} />
      <path d="M-4 -18 V-27 Q0 -31 4 -27 V-18" fill="var(--map-wood)" {...LINE} />
      <Lamp x={0} y={-40} r={4} lit={lit} />
      {[18, 108, 198, 288].map((angle) => (
        <g key={angle} transform={`translate(0 -58) rotate(${angle})`}>
          <path d="M-1 0 V-30 M1 -6 H7 V-28 H1" fill="var(--surface)" {...LINE} />
        </g>
      ))}
      <circle cx={0} cy={-58} r={2.5} fill="var(--ink)" />
    </>
  );
}

function Arch({ lit }: { lit: boolean }) {
  return (
    <>
      <path d="M-24 -18 V-44 A24 24 0 0 1 24 -44 V-18 H14 V-44 A14 14 0 0 0 -14 -44 V-18Z" fill="var(--surface)" {...LINE} />
      <path d="M-28 -18 H-10 M10 -18 H28 M-3 -68 H3" {...LINE} />
      <path d="M0 -58 V-53" {...LINE} />
      <Lamp x={0} y={-48} lit={lit} />
      <circle cx={-34} cy={-24} r={7} fill="var(--map-tree)" />
      <circle cx={34} cy={-24} r={7} fill="var(--map-tree)" />
    </>
  );
}

function Observatory({ lit }: { lit: boolean }) {
  return (
    <>
      <path d="M-20 -18 V-38 H20 V-18Z" fill="var(--surface)" {...LINE} />
      <path d="M-18 -38 A18 18 0 0 1 18 -38Z" fill="var(--map-wood)" {...LINE} />
      <path d="M-3 -55 H3 L4 -38 H-4Z" fill={lit ? 'var(--accent)' : 'var(--map-rock)'} {...LINE} />
      <path d="M2 -48 L18 -64" {...LINE} strokeWidth={4} />
      <path d="M-4 -18 V-28 H4 V-18" fill="var(--map-wood)" {...LINE} />
      {lit && <circle cx={0} cy={-46} r={20} fill="url(#garden-glow)" />}
    </>
  );
}

function Lighthouse({ lit }: { lit: boolean }) {
  return (
    <>
      {lit && <path d="M42 -46 L-70 -88 L-70 -10Z" fill="url(#garden-beam)" />}
      <ellipse cx={42} cy={22} rx={36} ry={11} fill="var(--map-rock)" {...LINE} />
      <path d="M33 16 L37 -40 H47 L51 16Z" fill="var(--surface)" {...LINE} />
      <path d="M34.3 -2 L35 -12 H49 L49.7 -2Z M35.9 -24 L36.4 -32 H47.6 L48.1 -24Z" fill="var(--accent)" opacity={0.85} />
      <path d="M31 -40 H53 V-36 H31Z" fill="var(--ink)" />
      <path d="M36 -52 H48 V-40 H36Z" fill={lit ? 'var(--accent)' : 'var(--map-rock)'} {...LINE} />
      <path d="M33 -52 L42 -63 L51 -52Z" fill="var(--ink)" />
      {lit && <circle cx={42} cy={-46} r={22} fill="url(#garden-glow)" />}
    </>
  );
}

const LANDMARKS = [Pier, Bridge, Windmill, Arch, Observatory, Lighthouse];

/** Рисунок без подписей: подписи и управление — у кнопок поверх него. done — сколько мест подряд восстановлено */
export function GardenScene({ lit, done }: { lit: boolean[]; done: number }) {
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block w-full" aria-hidden>
      <defs>
        <radialGradient id="garden-glow">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="garden-beam" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="var(--map-land)" />
      <path d="M8 168 C 34 112, 96 72, 162 90 C 206 102, 216 138, 196 168 C 150 182, 60 186, 8 168Z" fill="var(--map-hill)" />
      <path d="M262 176 C 290 120, 372 104, 418 82 C 470 58, 530 74, 552 108 C 572 140, 534 168, 482 172 C 400 184, 320 190, 262 176Z"
        fill="var(--map-hill)" />
      <path d="M0 222 C 40 224, 66 242, 64 258 C 62 280, 100 296, 160 300 C 260 306, 330 292, 420 300 C 486 306, 520 292, 540 274
        C 560 256, 604 262, 640 250 V340 H0Z" fill="var(--map-water)" />
      <path d="M24 318 h26 M120 326 h18 M300 320 h30 M470 324 h22 M590 300 h20" stroke="var(--map-path)" strokeWidth={1.5}
        strokeLinecap="round" opacity={0.6} />
      <path d="M252 -6 C 238 40, 264 92, 238 132 C 216 166, 204 176, 210 196 C 216 226, 250 252, 244 302" fill="none"
        stroke="var(--map-water)" strokeWidth={10} strokeLinecap="round" />
      {STARS.map(([x, y], i) => <circle key={x} cx={x} cy={y} r={i % 2 ? 1.5 : 2.2} fill="var(--map-path)" />)}
      {TREES.map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <path d={`M${x} ${y} V${y + r + 4}`} stroke="var(--map-wood)" strokeWidth={2} />
          <circle cx={x} cy={y} r={r} fill="var(--map-tree)" />
        </g>
      ))}
      <path d={trail(PLACES, 0, PLACES.length - 1)} fill="none" stroke="var(--map-path)" strokeWidth={3}
        strokeDasharray="1 8" strokeLinecap="round" />
      {done > 0 && (
        <path d={trail(PLACES, 0, Math.min(done, PLACES.length - 1))} fill="none" stroke="var(--accent)" strokeWidth={4}
          strokeLinecap="round" />
      )}
      {LANDMARKS.map((Landmark, i) => (
        <g key={i} transform={`translate(${PLACES[i][0]} ${PLACES[i][1]})`}>
          <Landmark lit={lit[i]} />
        </g>
      ))}
    </svg>
  );
}
