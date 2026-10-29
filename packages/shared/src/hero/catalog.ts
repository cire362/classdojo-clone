/**
 * Каталог деталей героя — единый источник правды для фронтенда (отрисовка)
 * и бэкенда (проверка выбора, синхронизация таблицы HeroPart).
 *
 * Все детали — собственные оригинальные SVG-фрагменты в едином стиле:
 * холст 200×240, контур {outline} толщиной 3, плоская заливка.
 * В разметке можно использовать плейсхолдеры цветов:
 *   {suit} {suitDark} {accent} {accentDark} {skin} {skinDark} {hair} {hairDark} {outline}
 * Как добавить новую деталь — см. README, раздел «Новые детали героев».
 */

export type HeroLayer =
  | 'pose'
  | 'suit'
  | 'mask'
  | 'cape'
  | 'emblem'
  | 'hair'
  | 'color'
  | 'skin'
  | 'hairColor'
  | 'aura';

export interface HeroPartDef {
  /** Уникальный id вида `<слой>.<ключ>` — он же «id SVG» */
  id: string;
  layer: HeroLayer;
  name: string;
  requiredLevel: number;
  /** Слой за телом (плащ, длинные волосы) */
  back?: string;
  /** Слой поверх тела */
  front?: string;
  /** Для цветов, кожи и цвета волос */
  color?: string;
  hidesHair?: boolean;
  hidesEyes?: boolean;
  hidesMouth?: boolean;
  /** Деталь маски рисуется поверх причёски (корона, нимб) */
  overHair?: boolean;
  /** Премиум-коллекция: доступна ученикам, если у создателя их группы подключён премиум (и по уровню) */
  premium?: boolean;
}

/** Слоты героя → тип слоя. Порядок = порядок вкладок в конструкторе. */
export const HERO_SLOTS = {
  pose: 'pose',
  suit: 'suit',
  suitColor: 'color',
  accentColor: 'color',
  cape: 'cape',
  mask: 'mask',
  emblem: 'emblem',
  aura: 'aura',
  skin: 'skin',
  hair: 'hair',
  hairColor: 'hairColor',
} as const satisfies Record<string, HeroLayer>;

export type HeroSlot = keyof typeof HERO_SLOTS;
export type HeroParts = Record<HeroSlot, string>;

export const HERO_SLOT_LABELS: Record<HeroSlot, string> = {
  pose: 'Поза',
  suit: 'Костюм',
  suitColor: 'Цвет костюма',
  accentColor: 'Цвет плаща и деталей',
  cape: 'Плащ',
  mask: 'Маска',
  emblem: 'Эмблема',
  aura: 'Сияние',
  skin: 'Тон кожи',
  hair: 'Причёска',
  hairColor: 'Цвет волос',
};

const O = 'stroke="{outline}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';

/** Рука-«трубка» с контуром: сначала толстый контур, сверху цвет костюма */
function arm(d: string): string {
  return (
    `<path d="${d}" fill="none" stroke="{outline}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="{suit}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
function glove(cx: number, cy: number, r = 9): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="{accent}" ${O}/>`;
}
function star(cx: number, cy: number, R: number, r: number, attrs: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" ${attrs}/>`;
}

/** Подложка эмблемы — скруглённый квадрат на груди */
const BADGE = `<rect x="87" y="111" width="26" height="26" rx="8" fill="#ffffff" ${O}/>`;
const EM = 'fill="{suit}" stroke="{outline}" stroke-width="1.5" stroke-linejoin="round"';

const BELT =
  `<rect x="73" y="141" width="54" height="8" rx="2" fill="{accentDark}" ${O}/>` +
  `<rect x="93" y="139" width="14" height="12" rx="3" fill="#ffd23f" ${O}/>`;

const HAIR_SHORT_FRONT = `<path d="M64 62 Q62 27 100 27 Q138 27 136 62 Q128 45 112 43 Q100 50 88 43 Q72 45 64 62 Z" fill="{hair}" ${O}/>`;

const CAPE_CLASPS =
  `<circle cx="79" cy="106" r="5" fill="#ffd23f" ${O}/><circle cx="121" cy="106" r="5" fill="#ffd23f" ${O}/>`;

const parts: HeroPartDef[] = [
  // ───────── Позы (руки) ─────────
  {
    id: 'pose.stand',
    layer: 'pose',
    name: 'Готов к делу',
    requiredLevel: 1,
    front: arm('M74 110 Q62 130 62 150') + arm('M126 110 Q138 130 138 150') + glove(62, 155) + glove(138, 155),
  },
  {
    id: 'pose.hips',
    layer: 'pose',
    name: 'Руки в боки',
    requiredLevel: 1,
    front: arm('M74 110 L54 132 L72 148') + arm('M126 110 L146 132 L128 148') + glove(74, 149, 8) + glove(126, 149, 8),
  },
  {
    id: 'pose.fist',
    layer: 'pose',
    name: 'Вперёд!',
    requiredLevel: 2,
    front: arm('M74 110 Q62 130 62 150') + arm('M126 110 Q146 96 150 70') + glove(62, 155) + glove(151, 62, 10),
  },
  {
    id: 'pose.victory',
    layer: 'pose',
    name: 'Победа',
    requiredLevel: 4,
    front: arm('M74 110 Q54 96 50 70') + arm('M126 110 Q146 96 150 70') + glove(49, 62, 10) + glove(151, 62, 10),
  },
  {
    id: 'pose.flex',
    layer: 'pose',
    name: 'Сила',
    requiredLevel: 6,
    front: arm('M74 110 L50 114 L48 90') + arm('M126 110 L150 114 L152 90') + glove(48, 84, 10) + glove(152, 84, 10),
  },

  {
    id: 'pose.wave',
    layer: 'pose',
    name: 'Привет!',
    requiredLevel: 7,
    front:
      arm('M74 110 L54 132 L72 148') +
      arm('M126 110 Q148 104 152 80') +
      glove(74, 149, 8) +
      glove(153, 70, 10) +
      // Дуги «машет рукой»
      `<path d="M167 58 Q173 68 167 78" fill="none" stroke="{outline}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M176 52 Q184 68 176 84" fill="none" stroke="{outline}" stroke-width="3" stroke-linecap="round"/>`,
  },

  // ───────── Костюмы (детали поверх базового комбинезона) ─────────
  {
    id: 'suit.classic',
    layer: 'suit',
    name: 'Классика',
    requiredLevel: 1,
    front:
      `<path d="M74 146 L126 146 L127 166 Q114 170 100 163 Q86 170 73 166 Z" fill="{accent}" ${O}/>` + BELT,
  },
  {
    id: 'suit.sport',
    layer: 'suit',
    name: 'Спортивный',
    requiredLevel: 1,
    front:
      `<path d="M73 114 L77 156 M127 114 L123 156 M81 162 L81 196 M119 162 L119 196" stroke="{accent}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
      `<path d="M88 102 L100 116 L112 102" fill="none" stroke="{accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'suit.armor',
    layer: 'suit',
    name: 'Броня',
    requiredLevel: 3,
    front:
      `<path d="M80 105 L120 105 L118 136 Q100 147 82 136 Z" fill="{suitDark}" ${O}/>` +
      `<circle cx="87" cy="182" r="6" fill="{accent}" ${O}/><circle cx="113" cy="182" r="6" fill="{accent}" ${O}/>` +
      BELT,
  },
  {
    id: 'suit.lightning',
    layer: 'suit',
    name: 'Разряд',
    requiredLevel: 5,
    front:
      `<path d="M71 140 L84 131 L94 141 L106 131 L116 141 L129 132" fill="none" stroke="{accent}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<path d="M78 170 L86 178 L78 186 L86 194 M122 170 L114 178 L122 186 L114 194" fill="none" stroke="{accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`,
  },
  {
    id: 'suit.starry',
    layer: 'suit',
    name: 'Звёздный',
    requiredLevel: 7,
    front:
      star(80, 146, 5, 2.2, 'fill="#ffffff" opacity="0.9"') +
      star(121, 108, 4, 1.8, 'fill="#ffffff" opacity="0.9"') +
      star(88, 172, 4, 1.8, 'fill="#ffffff" opacity="0.9"') +
      star(114, 190, 5, 2.2, 'fill="#ffffff" opacity="0.9"') +
      star(122, 150, 3.5, 1.5, 'fill="#ffffff" opacity="0.9"') +
      `<path d="M74 146 L126 146 L127 166 Q114 170 100 163 Q86 170 73 166 Z" fill="{accent}" ${O}/>` + BELT,
  },
  {
    id: 'suit.cosmic',
    layer: 'suit',
    name: 'Космический',
    requiredLevel: 9,
    front:
      `<path d="M76 108 L90 126 L90 150 M124 108 L110 126 L110 150 M82 160 L88 200 M118 160 L112 200" fill="none" stroke="#7df9ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<rect x="73" y="141" width="54" height="8" rx="4" fill="#7df9ff" ${O}/>` +
      `<circle cx="100" cy="145" r="6" fill="#ffffff" ${O}/>`,
  },

  {
    id: 'suit.knight',
    layer: 'suit',
    name: 'Рыцарь',
    requiredLevel: 8,
    front:
      `<path d="M79 104 L121 104 L119 140 L100 150 L81 140 Z" fill="{suitDark}" ${O}/>` +
      `<path d="M100 106 L100 148" stroke="#ffffff" stroke-width="2" opacity="0.5"/>` +
      `<circle cx="85" cy="110" r="2" fill="#ffffff"/><circle cx="115" cy="110" r="2" fill="#ffffff"/>` +
      `<path d="M78 172 L96 172 L87 186 Z M104 172 L122 172 L113 186 Z" fill="{accent}" ${O}/>` +
      BELT,
  },
  {
    id: 'suit.legend',
    layer: 'suit',
    name: 'Легенда',
    requiredLevel: 10,
    front:
      `<path d="M85 102 L100 113 L115 102" fill="none" stroke="#1b1f4b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M85 102 L100 113 L115 102" fill="none" stroke="#ffd23f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M79 128 L100 140 L121 128" fill="none" stroke="#1b1f4b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M79 128 L100 140 L121 128" fill="none" stroke="#ffd23f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M81 160 L81 194 M119 160 L119 194" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="73" y="141" width="54" height="8" rx="2" fill="#ffd23f" ${O}/>` +
      `<rect x="93" y="139" width="14" height="12" rx="3" fill="{accent}" ${O}/>`,
  },
  {
    id: 'suit.astro',
    layer: 'suit',
    name: 'Астронавт',
    requiredLevel: 2,
    premium: true,
    front:
      `<path d="M80 103 Q100 116 120 103" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M80 103 Q100 116 120 103" fill="none" stroke="{outline}" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="86" y="120" width="28" height="20" rx="5" fill="#ffffff" ${O}/>` +
      `<circle cx="94" cy="130" r="3" fill="#e63946"/><circle cx="102" cy="130" r="3" fill="#ffd23f"/><circle cx="110" cy="130" r="3" fill="#2a9d55"/>` +
      `<path d="M76 150 L124 150" stroke="#ffffff" stroke-width="6"/><path d="M76 150 L124 150" stroke="{outline}" stroke-width="1.5" stroke-dasharray="4 3"/>` +
      `<path d="M79 176 L96 176 M104 176 L121 176" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>`,
  },

  // ───────── Плащи ─────────
  { id: 'cape.none', layer: 'cape', name: 'Без плаща', requiredLevel: 1 },
  {
    id: 'cape.classic',
    layer: 'cape',
    name: 'Длинный',
    requiredLevel: 1,
    back: `<path d="M76 103 L124 103 L152 222 Q100 234 48 222 Z" fill="{accent}" ${O}/>`,
    front: CAPE_CLASPS,
  },
  {
    id: 'cape.short',
    layer: 'cape',
    name: 'Короткий',
    requiredLevel: 2,
    back: `<path d="M76 103 L124 103 L140 172 Q100 182 60 172 Z" fill="{accent}" ${O}/>`,
    front: CAPE_CLASPS,
  },
  {
    id: 'cape.split',
    layer: 'cape',
    name: 'Двухвостый',
    requiredLevel: 4,
    back: `<path d="M76 103 L124 103 L148 222 L120 208 L100 224 L80 208 L52 222 Z" fill="{accent}" ${O}/>`,
    front: CAPE_CLASPS,
  },
  {
    id: 'cape.collar',
    layer: 'cape',
    name: 'С высоким воротником',
    requiredLevel: 6,
    back:
      `<path d="M76 103 L124 103 L152 222 Q100 234 48 222 Z" fill="{accent}" ${O}/>` +
      `<path d="M74 108 L56 66 L90 98 Z" fill="{accentDark}" ${O}/><path d="M126 108 L144 66 L110 98 Z" fill="{accentDark}" ${O}/>`,
    front: CAPE_CLASPS,
  },
  {
    id: 'cape.stars',
    layer: 'cape',
    name: 'Звездопад',
    requiredLevel: 7,
    back:
      `<path d="M76 103 L124 103 L152 222 Q100 234 48 222 Z" fill="{accent}" ${O}/>` +
      star(60, 206, 6, 2.6, 'fill="#ffffff" opacity="0.85"') +
      star(140, 200, 5, 2.2, 'fill="#ffffff" opacity="0.85"') +
      star(146, 172, 4, 1.8, 'fill="#ffffff" opacity="0.85"') +
      star(56, 178, 4, 1.8, 'fill="#ffffff" opacity="0.85"'),
    front: CAPE_CLASPS,
  },

  {
    id: 'cape.feather',
    layer: 'cape',
    name: 'Перья',
    requiredLevel: 8,
    back:
      `<path d="M76 103 L124 103 L154 204 Q152 226 136 216 Q130 236 115 221 Q100 238 85 221 Q70 236 64 216 Q48 226 46 204 Z" fill="{accent}" ${O}/>` +
      `<path d="M136 216 L132 186 M64 216 L68 186 M150 206 L142 176 M50 206 L58 176" stroke="{accentDark}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
    front: CAPE_CLASPS,
  },
  {
    id: 'cape.legend',
    layer: 'cape',
    name: 'Золотой',
    requiredLevel: 10,
    back:
      `<path d="M76 103 L124 103 L154 224 Q100 236 46 224 Z" fill="#d4a017" ${O}/>` +
      `<path d="M84 108 L116 108 L140 214 Q100 224 60 214 Z" fill="{accent}" opacity="0.9"/>` +
      star(100, 196, 12, 5, `fill="#ffd23f" ${O}`),
    front: CAPE_CLASPS,
  },
  {
    id: 'cape.comet',
    layer: 'cape',
    name: 'Комета',
    requiredLevel: 3,
    premium: true,
    back:
      `<path d="M76 103 L124 103 L160 222 Q100 238 40 222 Z" fill="#2a2470" ${O}/>` +
      `<path d="M86 110 L114 110 L140 214 Q100 224 60 214 Z" fill="{accent}" opacity="0.3"/>` +
      // Комета: хвост и звезда на краю плаща, где их не закрывает тело
      `<path d="M150 214 L132 150" stroke="#ffd23f" stroke-width="5" stroke-linecap="round" opacity="0.55"/>` +
      `<path d="M150 214 L138 168" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>` +
      star(150, 212, 9, 3.8, `fill="#ffd23f" ${O}`) +
      `<circle cx="52" cy="206" r="2.4" fill="#ffffff"/><circle cx="60" cy="184" r="1.8" fill="#ffffff"/><circle cx="46" cy="196" r="1.5" fill="#ffffff"/>`,
    front: CAPE_CLASPS,
  },

  // ───────── Маски ─────────
  { id: 'mask.none', layer: 'mask', name: 'Без маски', requiredLevel: 1 },
  {
    id: 'mask.domino',
    layer: 'mask',
    name: 'Полумаска',
    requiredLevel: 1,
    front: `<path d="M68 60 Q78 51 92 55 L100 60 L108 55 Q122 51 132 60 Q130 75 114 76 Q104 75 100 68 Q96 75 86 76 Q70 75 68 60 Z" fill="{accentDark}" ${O}/>`,
  },
  {
    id: 'mask.bandana',
    layer: 'mask',
    name: 'Повязка',
    requiredLevel: 2,
    front:
      `<path d="M134 61 L152 54 L147 66 L153 77 L134 71 Z" fill="{accentDark}" ${O}/>` +
      `<path d="M65 57 Q100 49 135 57 L136 74 Q100 67 64 74 Z" fill="{accent}" ${O}/>`,
  },
  {
    id: 'mask.half',
    layer: 'mask',
    name: 'Защита лица',
    requiredLevel: 3,
    hidesMouth: true,
    front: `<path d="M66 72 Q100 66 134 72 Q132 96 100 98 Q68 96 66 72 Z" fill="{accentDark}" ${O}/>`,
  },
  {
    id: 'mask.visor',
    layer: 'mask',
    name: 'Визор',
    requiredLevel: 4,
    hidesEyes: true,
    front:
      `<rect x="68" y="55" width="64" height="21" rx="10.5" fill="#26304f" ${O}/>` +
      `<path d="M78 61 L96 61" stroke="#7df9ff" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M104 61 L110 61" stroke="#7df9ff" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: 'mask.helmet',
    layer: 'mask',
    name: 'Шлем',
    requiredLevel: 5,
    hidesHair: true,
    front:
      `<path d="M95 30 L100 12 L105 30 Z" fill="{accent}" ${O}/>` +
      `<path d="M62 72 Q58 25 100 25 Q142 25 138 72 L129 72 Q127 56 114 53 L86 53 Q73 56 71 72 Z" fill="{suit}" ${O}/>` +
      `<path d="M82 34 Q100 28 118 34" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`,
  },
  {
    id: 'mask.winged',
    layer: 'mask',
    name: 'Крылатый шлем',
    requiredLevel: 8,
    hidesHair: true,
    front:
      `<path d="M64 52 L38 34 L44 46 L34 48 L46 56 L40 62 L64 62 Z" fill="#ffffff" ${O}/>` +
      `<path d="M136 52 L162 34 L156 46 L166 48 L154 56 L160 62 L136 62 Z" fill="#ffffff" ${O}/>` +
      `<path d="M62 72 Q58 25 100 25 Q142 25 138 72 L129 72 Q127 56 114 53 L86 53 Q73 56 71 72 Z" fill="#d4a017" ${O}/>` +
      `<path d="M82 34 Q100 28 118 34" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`,
  },

  {
    id: 'mask.goggles',
    layer: 'mask',
    name: 'Очки пилота',
    requiredLevel: 6,
    front:
      `<path d="M64 62 Q66 58 74 60 M126 60 Q134 58 136 62" fill="none" stroke="{accentDark}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M97 66 L103 66" stroke="{outline}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="86" cy="66" r="12.5" fill="#bfe9ff" fill-opacity="0.55" stroke="{accentDark}" stroke-width="4"/>` +
      `<circle cx="114" cy="66" r="12.5" fill="#bfe9ff" fill-opacity="0.55" stroke="{accentDark}" stroke-width="4"/>`,
  },
  {
    id: 'mask.crown',
    layer: 'mask',
    name: 'Корона',
    requiredLevel: 9,
    overHair: true,
    front:
      `<path d="M77 36 L79 14 L90 26 L100 8 L110 26 L121 14 L123 36 Z" fill="#ffd23f" ${O}/>` +
      `<circle cx="100" cy="27" r="3.5" fill="#e63946" ${O}/><circle cx="86" cy="30" r="2.5" fill="#2f6fde"/><circle cx="114" cy="30" r="2.5" fill="#2a9d55"/>`,
  },
  {
    id: 'mask.halo',
    layer: 'mask',
    name: 'Нимб',
    requiredLevel: 10,
    overHair: true,
    front:
      `<ellipse cx="100" cy="14" rx="30" ry="8" fill="none" stroke="#ffd23f" stroke-width="9" opacity="0.35"/>` +
      `<ellipse cx="100" cy="14" rx="30" ry="8" fill="none" stroke="#ffe066" stroke-width="4"/>`,
  },

  // ───────── Эмблемы ─────────
  { id: 'emblem.none', layer: 'emblem', name: 'Без эмблемы', requiredLevel: 1 },
  { id: 'emblem.star', layer: 'emblem', name: 'Звезда', requiredLevel: 1, front: BADGE + star(100, 124.5, 9.5, 4, EM) },
  {
    id: 'emblem.heart',
    layer: 'emblem',
    name: 'Сердце',
    requiredLevel: 1,
    front: BADGE + `<path d="M100 132 L91 123 Q87 118 91 115 Q96 112 100 118 Q104 112 109 115 Q113 118 109 123 Z" ${EM}/>`,
  },
  {
    id: 'emblem.bolt',
    layer: 'emblem',
    name: 'Молния',
    requiredLevel: 1,
    front: BADGE + `<path d="M103 114 L93 126 L99 126 L96 135 L107 122 L101 122 Z" ${EM}/>`,
  },
  {
    id: 'emblem.leaf',
    layer: 'emblem',
    name: 'Лист',
    requiredLevel: 2,
    front:
      BADGE +
      `<path d="M92 132 Q90 116 108 115 Q110 131 92 132 Z" ${EM}/><path d="M93 131 L104 120" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  {
    id: 'emblem.flame',
    layer: 'emblem',
    name: 'Пламя',
    requiredLevel: 2,
    front: BADGE + `<path d="M100 134 Q90 133 91 124 Q92 118 97 114 Q97 120 101 121 Q101 116 104 113 Q110 120 109 126 Q108 133 100 134 Z" ${EM}/>`,
  },
  {
    id: 'emblem.drop',
    layer: 'emblem',
    name: 'Капля',
    requiredLevel: 3,
    front: BADGE + `<path d="M100 113 Q109 124 109 127 Q109 134 100 134 Q91 134 91 127 Q91 124 100 113 Z" ${EM}/>`,
  },
  {
    id: 'emblem.sun',
    layer: 'emblem',
    name: 'Солнце',
    requiredLevel: 3,
    front:
      BADGE +
      `<path d="M100 113 L100 116 M100 132 L100 135 M89 124 L92 124 M108 124 L111 124 M92 116 L94 118 M106 130 L108 132 M108 116 L106 118 M94 130 L92 132" stroke="{suit}" stroke-width="2.2" stroke-linecap="round"/>` +
      `<circle cx="100" cy="124" r="5.5" ${EM}/>`,
  },
  {
    id: 'emblem.rocket',
    layer: 'emblem',
    name: 'Ракета',
    requiredLevel: 4,
    front:
      BADGE +
      `<path d="M100 113 Q106 118 105 128 L95 128 Q94 118 100 113 Z" ${EM}/>` +
      `<path d="M95 124 L91 131 L96 129 Z M105 124 L109 131 L104 129 Z" ${EM}/>` +
      `<path d="M98 130 L100 135 L102 130 Z" fill="#f77f00"/>`,
  },
  {
    id: 'emblem.note',
    layer: 'emblem',
    name: 'Нота',
    requiredLevel: 4,
    front:
      BADGE +
      `<path d="M98 115 L107 113 L107 128" fill="none" stroke="{suit}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M98 115 L98 131" stroke="{suit}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<ellipse cx="95" cy="131" rx="3.6" ry="2.8" ${EM}/><ellipse cx="104" cy="128" rx="3.6" ry="2.8" ${EM}/>`,
  },
  {
    id: 'emblem.crown',
    layer: 'emblem',
    name: 'Корона',
    requiredLevel: 5,
    front: BADGE + `<path d="M91 130 L90 117 L95 122 L100 115 L105 122 L110 117 L109 130 Z" ${EM}/>`,
  },
  {
    id: 'emblem.snowflake',
    layer: 'emblem',
    name: 'Снежинка',
    requiredLevel: 6,
    front:
      BADGE +
      `<path d="M100 114 L100 134 M91.3 119 L108.7 129 M91.3 129 L108.7 119 M97 115.5 L100 118 L103 115.5 M97 132.5 L100 130 L103 132.5" fill="none" stroke="{suit}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'emblem.planet',
    layer: 'emblem',
    name: 'Планета',
    requiredLevel: 6,
    front:
      BADGE +
      `<circle cx="100" cy="124" r="6" ${EM}/>` +
      `<ellipse cx="100" cy="124" rx="11" ry="3.5" fill="none" stroke="{suit}" stroke-width="1.8" transform="rotate(-20 100 124)"/>`,
  },
  {
    id: 'emblem.atom',
    layer: 'emblem',
    name: 'Атом',
    requiredLevel: 8,
    front:
      BADGE +
      `<g fill="none" stroke="{suit}" stroke-width="1.6"><ellipse cx="100" cy="124" rx="10" ry="4"/><ellipse cx="100" cy="124" rx="10" ry="4" transform="rotate(60 100 124)"/><ellipse cx="100" cy="124" rx="10" ry="4" transform="rotate(-60 100 124)"/></g>` +
      `<circle cx="100" cy="124" r="2.4" fill="{suit}"/>`,
  },
  {
    id: 'emblem.gem',
    layer: 'emblem',
    name: 'Кристалл',
    requiredLevel: 10,
    front:
      BADGE +
      `<path d="M93 119 L97 114 L103 114 L107 119 L100 134 Z" ${EM}/><path d="M93 119 L107 119 M97 114 L100 119 L103 114 M100 119 L100 134" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.8"/>`,
  },

  {
    id: 'emblem.paw',
    layer: 'emblem',
    name: 'Лапка',
    requiredLevel: 7,
    front:
      BADGE +
      `<ellipse cx="100" cy="128.5" rx="6" ry="5" ${EM}/>` +
      `<circle cx="92.5" cy="121" r="2.6" ${EM}/><circle cx="97.5" cy="117" r="2.6" ${EM}/><circle cx="102.5" cy="117" r="2.6" ${EM}/><circle cx="107.5" cy="121" r="2.6" ${EM}/>`,
  },
  {
    id: 'emblem.infinity',
    layer: 'emblem',
    name: 'Бесконечность',
    requiredLevel: 9,
    front:
      BADGE +
      `<path d="M100 124 C96 117 89 117 89 124 C89 131 96 131 100 124 C104 117 111 117 111 124 C111 131 104 131 100 124 Z" fill="none" stroke="{suit}" stroke-width="2.6" stroke-linejoin="round"/>`,
  },
  {
    id: 'emblem.diamond',
    layer: 'emblem',
    name: 'Алмаз',
    requiredLevel: 1,
    premium: true,
    front:
      BADGE +
      `<path d="M93 119 L97 114 L103 114 L107 119 L100 131 Z" ${EM}/>` +
      `<path d="M93 119 L107 119 M97 114 L100 119 L103 114 M100 119 L100 131" fill="none" stroke="{outline}" stroke-width="1.2"/>`,
  },

  // ───────── Сияние (фон за героем, только на старших уровнях) ─────────
  { id: 'aura.none', layer: 'aura', name: 'Без сияния', requiredLevel: 1 },
  {
    id: 'aura.glow',
    layer: 'aura',
    name: 'Свечение',
    requiredLevel: 6,
    back:
      `<circle cx="100" cy="118" r="96" fill="{accent}" opacity="0.16"/>` +
      `<circle cx="100" cy="118" r="74" fill="{accent}" opacity="0.2"/>` +
      `<circle cx="100" cy="118" r="52" fill="#ffffff" opacity="0.25"/>`,
  },
  {
    id: 'aura.rays',
    layer: 'aura',
    name: 'Лучи',
    requiredLevel: 7,
    back: Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      const p = (r: number, d: number) =>
        `${(100 + r * Math.cos(a + d)).toFixed(1)},${(112 + r * Math.sin(a + d)).toFixed(1)}`;
      return `<polygon points="${p(46, -0.09)} ${p(118, 0)} ${p(46, 0.09)}" fill="{accent}" opacity="0.45"/>`;
    }).join(''),
  },
  {
    id: 'aura.stars',
    layer: 'aura',
    name: 'Звёзды',
    requiredLevel: 8,
    back:
      star(30, 60, 11, 4.6, `fill="{accent}" ${O}`) +
      star(170, 52, 9, 3.8, `fill="#ffffff" ${O}`) +
      star(22, 140, 8, 3.4, `fill="#ffffff" ${O}`) +
      star(178, 132, 11, 4.6, `fill="{accent}" ${O}`) +
      star(40, 206, 7, 3, `fill="{accent}" ${O}`) +
      star(164, 210, 8, 3.4, `fill="#ffffff" ${O}`) +
      star(150, 18, 6, 2.6, `fill="{accent}" ${O}`) +
      star(52, 20, 6, 2.6, `fill="#ffffff" ${O}`),
  },
  {
    id: 'aura.lightning',
    layer: 'aura',
    name: 'Разряды',
    requiredLevel: 9,
    back:
      `<path d="M32 40 L18 82 L32 82 L20 124 L48 74 L34 74 L46 40 Z" fill="#ffd23f" ${O}/>` +
      `<path d="M168 40 L182 82 L168 82 L180 124 L152 74 L166 74 L154 40 Z" fill="#ffd23f" ${O}/>` +
      `<path d="M26 150 L16 178 L26 178 L18 206 L38 172 L28 172 L36 150 Z" fill="#ffd23f" ${O}/>` +
      `<path d="M174 150 L184 178 L174 178 L182 206 L162 172 L172 172 L164 150 Z" fill="#ffd23f" ${O}/>`,
  },
  {
    id: 'aura.rainbow',
    layer: 'aura',
    name: 'Радуга',
    requiredLevel: 10,
    back: ['#e63946', '#f77f00', '#f4c430', '#2a9d55', '#2f6fde', '#7b4fd6']
      .map((c, i) => {
        const r = 96 - i * 8;
        return `<path d="M${100 - r} 160 A${r} ${r} 0 0 1 ${100 + r} 160" fill="none" stroke="${c}" stroke-width="8"/>`;
      })
      .join(''),
  },

  // ───────── Причёски ─────────
  { id: 'hair.buzz', layer: 'hair', name: 'Ёжик', requiredLevel: 1, front: `<path d="M66 54 Q72 30 100 30 Q128 30 134 54 Q118 42 100 42 Q82 42 66 54 Z" fill="{hair}" ${O}/>` },
  { id: 'hair.short', layer: 'hair', name: 'Короткая', requiredLevel: 1, front: HAIR_SHORT_FRONT },
  {
    id: 'hair.spiky',
    layer: 'hair',
    name: 'Торчком',
    requiredLevel: 1,
    front: `<path d="M64 60 L58 40 L73 42 L72 23 L88 33 L96 16 L106 31 L120 19 L122 38 L140 36 L136 60 Q120 44 100 46 Q80 44 64 60 Z" fill="{hair}" ${O}/>`,
  },
  {
    id: 'hair.long',
    layer: 'hair',
    name: 'Длинные',
    requiredLevel: 1,
    back: `<path d="M62 60 Q60 24 100 24 Q140 24 138 60 L146 112 Q132 120 120 108 L80 108 Q68 120 54 112 Z" fill="{hair}" ${O}/>`,
    front: `<path d="M64 64 Q60 26 100 26 Q140 26 136 64 Q130 46 118 42 Q104 52 82 44 Q70 48 64 64 Z" fill="{hair}" ${O}/>`,
  },
  {
    id: 'hair.curly',
    layer: 'hair',
    name: 'Кудри',
    requiredLevel: 1,
    front: `<path d="M62 66 A12 12 0 0 1 68 44 A13 13 0 0 1 87 31 A14 14 0 0 1 113 31 A13 13 0 0 1 132 44 A12 12 0 0 1 138 66 Q122 50 100 52 Q78 50 62 66 Z" fill="{hair}" ${O}/>`,
  },
  {
    id: 'hair.ponytail',
    layer: 'hair',
    name: 'Хвостик',
    requiredLevel: 1,
    back: `<path d="M126 36 Q164 42 156 100 Q146 84 132 68 Z" fill="{hair}" ${O}/>`,
    front: HAIR_SHORT_FRONT + `<circle cx="132" cy="40" r="5" fill="{accent}" ${O}/>`,
  },
  {
    id: 'hair.buns',
    layer: 'hair',
    name: 'Два пучка',
    requiredLevel: 1,
    back: `<circle cx="70" cy="34" r="13" fill="{hair}" ${O}/><circle cx="130" cy="34" r="13" fill="{hair}" ${O}/>`,
    front: HAIR_SHORT_FRONT,
  },
  {
    id: 'aura.galaxy',
    layer: 'aura',
    name: 'Галактика',
    requiredLevel: 4,
    premium: true,
    back:
      `<circle cx="100" cy="116" r="98" fill="#2a2470" opacity="0.85"/>` +
      `<ellipse cx="100" cy="116" rx="96" ry="34" fill="#7b4fd6" opacity="0.45" transform="rotate(-20 100 116)"/>` +
      `<ellipse cx="100" cy="116" rx="70" ry="20" fill="{accent}" opacity="0.3" transform="rotate(-20 100 116)"/>` +
      `<circle cx="28" cy="70" r="10" fill="#ff6f61" ${O}/><path d="M14 72 Q28 62 42 68" fill="none" stroke="#ffd23f" stroke-width="3"/>` +
      `<circle cx="172" cy="168" r="7" fill="#3ccfa6" ${O}/>` +
      [[44, 30], [160, 40], [182, 96], [20, 150], [58, 214], [150, 214], [120, 22], [36, 110]]
        .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.8 : 2.6}" fill="#ffffff"/>`)
        .join(''),
  },

  // ───────── Цвета костюма и деталей ─────────
  { id: 'color.red', layer: 'color', name: 'Красный', requiredLevel: 1, color: '#e63946' },
  { id: 'color.blue', layer: 'color', name: 'Синий', requiredLevel: 1, color: '#2f6fde' },
  { id: 'color.green', layer: 'color', name: 'Зелёный', requiredLevel: 1, color: '#2a9d55' },
  { id: 'color.orange', layer: 'color', name: 'Оранжевый', requiredLevel: 1, color: '#f77f00' },
  { id: 'color.purple', layer: 'color', name: 'Фиолетовый', requiredLevel: 1, color: '#7b4fd6' },
  { id: 'color.teal', layer: 'color', name: 'Бирюзовый', requiredLevel: 1, color: '#14a3a3' },
  { id: 'color.pink', layer: 'color', name: 'Розовый', requiredLevel: 1, color: '#ec5f9e' },
  { id: 'color.yellow', layer: 'color', name: 'Жёлтый', requiredLevel: 1, color: '#f4c430' },
  { id: 'color.navy', layer: 'color', name: 'Тёмно-синий', requiredLevel: 1, color: '#2a3570' },
  { id: 'color.silver', layer: 'color', name: 'Серебро', requiredLevel: 3, color: '#b8c2cc' },
  { id: 'color.gold', layer: 'color', name: 'Золото', requiredLevel: 5, color: '#d4a017' },
  { id: 'color.white', layer: 'color', name: 'Белый', requiredLevel: 6, color: '#f4f4f8' },
  { id: 'color.lime', layer: 'color', name: 'Неон', requiredLevel: 7, color: '#8ce010' },
  { id: 'color.obsidian', layer: 'color', name: 'Обсидиан', requiredLevel: 9, color: '#34344a' },
  { id: 'color.ruby', layer: 'color', name: 'Рубин', requiredLevel: 8, color: '#b3123c' },
  { id: 'color.emerald', layer: 'color', name: 'Изумруд', requiredLevel: 9, color: '#0b7a55' },
  { id: 'color.cosmic', layer: 'color', name: 'Космос', requiredLevel: 1, color: '#3b2a8f', premium: true },
  { id: 'color.coral', layer: 'color', name: 'Коралл', requiredLevel: 1, color: '#ff6f61', premium: true },

  // ───────── Тон кожи ─────────
  { id: 'skin.1', layer: 'skin', name: 'Светлый', requiredLevel: 1, color: '#ffe0c4' },
  { id: 'skin.2', layer: 'skin', name: 'Светло-бежевый', requiredLevel: 1, color: '#f5c99b' },
  { id: 'skin.3', layer: 'skin', name: 'Бежевый', requiredLevel: 1, color: '#e0a774' },
  { id: 'skin.4', layer: 'skin', name: 'Смуглый', requiredLevel: 1, color: '#b97a4f' },
  { id: 'skin.5', layer: 'skin', name: 'Тёмный', requiredLevel: 1, color: '#8a5634' },
  { id: 'skin.6', layer: 'skin', name: 'Очень тёмный', requiredLevel: 1, color: '#5c3a24' },
  { id: 'skin.7', layer: 'skin', name: 'Зелёный', requiredLevel: 1, color: '#8fd18a' },
  { id: 'skin.8', layer: 'skin', name: 'Голубой', requiredLevel: 1, color: '#9cc9f5' },

  // ───────── Цвет волос ─────────
  { id: 'hairColor.black', layer: 'hairColor', name: 'Чёрный', requiredLevel: 1, color: '#2b2321' },
  { id: 'hairColor.brown', layer: 'hairColor', name: 'Каштановый', requiredLevel: 1, color: '#6b4226' },
  { id: 'hairColor.blonde', layer: 'hairColor', name: 'Светлый', requiredLevel: 1, color: '#e8c26a' },
  { id: 'hairColor.red', layer: 'hairColor', name: 'Рыжий', requiredLevel: 1, color: '#c2462a' },
  { id: 'hairColor.gray', layer: 'hairColor', name: 'Седой', requiredLevel: 1, color: '#c9c9d1' },
  { id: 'hairColor.blue', layer: 'hairColor', name: 'Синий', requiredLevel: 1, color: '#3d7be0' },
  { id: 'hairColor.pink', layer: 'hairColor', name: 'Розовый', requiredLevel: 1, color: '#f07ab4' },
  { id: 'hairColor.violet', layer: 'hairColor', name: 'Фиалковый', requiredLevel: 1, color: '#8a63e8', premium: true },
];

export const HERO_PARTS: ReadonlyArray<HeroPartDef> = parts;

export const HERO_PARTS_BY_ID: ReadonlyMap<string, HeroPartDef> = new Map(parts.map((p) => [p.id, p]));

export function partsForLayer(layer: HeroLayer): HeroPartDef[] {
  return parts.filter((p) => p.layer === layer);
}

export const DEFAULT_HERO: HeroParts = {
  pose: 'pose.hips',
  suit: 'suit.sport',
  suitColor: 'color.teal',
  accentColor: 'color.orange',
  cape: 'cape.classic',
  mask: 'mask.domino',
  emblem: 'emblem.star',
  aura: 'aura.none',
  skin: 'skin.2',
  hair: 'hair.short',
  hairColor: 'hairColor.brown',
};

/** Случайный герой из базовых (1-й уровень) деталей — у каждого нового ученика свой вид */
export function randomHero(rand: () => number = Math.random): HeroParts {
  const result = { ...DEFAULT_HERO };
  for (const [slot, layer] of Object.entries(HERO_SLOTS) as [HeroSlot, HeroLayer][]) {
    // Для случайного героя берём только естественные тона кожи (skin.1–skin.6)
    const base = parts.filter(
      (p) => p.layer === layer && p.requiredLevel <= 1 && !p.premium && !(layer === 'skin' && Number(p.id.slice(5)) > 6),
    );
    result[slot] = base[Math.floor(rand() * base.length)].id;
  }
  if (result.accentColor === result.suitColor) {
    const colors = parts.filter((p) => p.layer === 'color' && p.requiredLevel <= 1 && !p.premium && p.id !== result.suitColor);
    result.accentColor = colors[Math.floor(rand() * colors.length)].id;
  }
  return result;
}
