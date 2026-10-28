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
  | 'hairColor';

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
      (p) => p.layer === layer && p.requiredLevel <= 1 && !(layer === 'skin' && Number(p.id.slice(5)) > 6),
    );
    result[slot] = base[Math.floor(rand() * base.length)].id;
  }
  if (result.accentColor === result.suitColor) {
    const colors = parts.filter((p) => p.layer === 'color' && p.requiredLevel <= 1 && p.id !== result.suitColor);
    result.accentColor = colors[Math.floor(rand() * colors.length)].id;
  }
  return result;
}
