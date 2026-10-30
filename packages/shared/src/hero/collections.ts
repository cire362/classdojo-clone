import type { HeroPartDef } from './catalog.js';

export const HERO_COLLECTIONS = [
  { id: 'cosmos', name: 'Космос', description: 'Скафандр, орбиты и далёкие планеты.' },
  { id: 'spring', name: 'Весна', description: 'Цветы, ростки и лёгкие лепестки.' },
  { id: 'summer', name: 'Лето', description: 'Солнце, морские волны и парус.' },
  { id: 'autumn', name: 'Осень', description: 'Тёплая охра и кружение листьев.' },
  { id: 'winter', name: 'Зима', description: 'Лёд, снежинки и тёплая шапка.' },
] as const;
export type HeroCollectionId = (typeof HERO_COLLECTIONS)[number]['id'];

// Собственные модульные SVG на прежнем холсте 200×240 и с контуром героев.
const O = 'stroke="{outline}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const BADGE = `<rect x="87" y="111" width="26" height="26" rx="8" fill="#ffffff" ${O}/>`;
const CLASPS = `<circle cx="79" cy="106" r="5" fill="#ffd23f" ${O}/><circle cx="121" cy="106" r="5" fill="#ffd23f" ${O}/>`;
function flower(x: number, y: number, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">` +
    [[0, -6], [6, -2], [4, 5], [-4, 5], [-6, -2]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="4.5" fill="#f4a7c8" stroke="{outline}" stroke-width="1.6"/>`).join('') +
    '<circle r="3.5" fill="#ffd23f" stroke="{outline}" stroke-width="1.6"/></g>';
}
function leaf(x: number, y: number, scale = 1, rotation = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 -12 L4 -6 L10 -8 L8 -1 L13 2 L5 6 L3 11 L0 8 L-3 11 L-5 6 L-13 2 L-8 -1 L-10 -8 L-4 -6 Z" fill="#e2a044" stroke="{outline}" stroke-width="2" stroke-linejoin="round"/><path d="M0 -6 L0 15" fill="none" stroke="{outline}" stroke-width="2" stroke-linecap="round"/></g>`;
}
function snow(x: number, y: number, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#4a9bb8" stroke-width="2" stroke-linecap="round">` +
    [0, 60, 120].map((r) => `<path transform="rotate(${r})" d="M0 -10 L0 10 M-3 -6 L0 -3 L3 -6 M-3 6 L0 3 L3 6"/>`).join('') + '</g>';
}

export const SEASONAL_PARTS: readonly HeroPartDef[] = [
  { id: 'color.pistachio', layer: 'color', name: 'Фисташка', requiredLevel: 1, premium: true, collection: 'spring', color: '#78b879' },
  { id: 'emblem.sprout', layer: 'emblem', name: 'Росток', requiredLevel: 1, premium: true, collection: 'spring', front: BADGE + `<path d="M100 131 L100 119 M100 126 Q89 127 91 117 Q100 116 100 126 M100 122 Q110 123 110 115 Q101 114 100 122" fill="#78b879" stroke="{outline}" stroke-width="1.8" stroke-linejoin="round"/>` },
  { id: 'suit.bloom', layer: 'suit', name: 'Цветущий', requiredLevel: 2, premium: true, collection: 'spring', front:
    `<path d="M78 107 Q89 110 100 115 Q111 110 122 107" fill="none" stroke="{accent}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M78 124 Q72 139 81 153 M122 124 Q128 139 119 153" fill="none" stroke="{accentDark}" stroke-width="3" stroke-linecap="round"/>` + flower(80, 146, 0.55) + flower(120, 178, 0.55) + flower(82, 191, 0.4) },
  { id: 'mask.flowerCrown', layer: 'mask', name: 'Венок цветов', requiredLevel: 2, premium: true, collection: 'spring', overHair: true, front:
    `<path d="M65 42 Q100 23 135 42" fill="none" stroke="{outline}" stroke-width="8" stroke-linecap="round"/><path d="M65 42 Q100 23 135 42" fill="none" stroke="#78b879" stroke-width="4" stroke-linecap="round"/>` + flower(73, 36, 0.85) + flower(100, 29) + flower(127, 36, 0.85) },
  { id: 'cape.petals', layer: 'cape', name: 'Лепестки', requiredLevel: 3, premium: true, collection: 'spring', back:
    `<path d="M76 103 L124 103 Q140 143 148 197 Q150 218 132 214 Q128 232 112 218 Q100 237 88 218 Q72 232 68 214 Q50 218 52 197 Q60 143 76 103 Z" fill="{accent}" ${O}/><path d="M76 130 Q66 172 68 202 M124 130 Q134 172 132 202" fill="none" stroke="{accentDark}" stroke-width="3" stroke-linecap="round"/>`, front: CLASPS },
  { id: 'aura.blossom', layer: 'aura', name: 'Цветение', requiredLevel: 5, premium: true, collection: 'spring', back:
    [[35, 43], [163, 49], [20, 110], [179, 115], [28, 179], [170, 190]].map(([x, y], i) => flower(x, y, i % 2 ? 0.8 : 0.65)).join('') + `<path d="M30 80 Q20 72 30 66 Q40 72 30 80 M170 154 Q160 146 170 140 Q180 146 170 154" fill="#78b879" stroke="{outline}" stroke-width="2"/>` },

  { id: 'color.lagoon', layer: 'color', name: 'Лагуна', requiredLevel: 1, premium: true, collection: 'summer', color: '#42bad0' },
  { id: 'emblem.watermelon', layer: 'emblem', name: 'Арбуз', requiredLevel: 1, premium: true, collection: 'summer', front: BADGE + `<path d="M90 118 Q100 141 110 118 Z" fill="#78b879" stroke="{outline}" stroke-width="1.5" stroke-linejoin="round"/><path d="M93 120 Q100 135 107 120 Z" fill="#f17a88"/><path d="M96 121 L97 123 M100 122 L100 125 M104 121 L103 123" stroke="{outline}" stroke-width="1.4" stroke-linecap="round"/>` },
  { id: 'suit.surf', layer: 'suit', name: 'Прибой', requiredLevel: 2, premium: true, collection: 'summer', front:
    `<path d="M74 139 Q81 131 88 139 T102 139 T116 139 T127 139 M77 151 Q84 143 91 151 T105 151 T124 151" fill="none" stroke="{accent}" stroke-width="5" stroke-linecap="round"/><path d="M80 174 Q87 167 94 174 M106 190 Q113 183 120 190" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>` },
  { id: 'mask.sunHat', layer: 'mask', name: 'Панама', requiredLevel: 2, premium: true, collection: 'summer', overHair: true, front:
    `<path d="M72 41 L78 20 Q100 13 122 20 L128 41 Z" fill="{accent}" ${O}/><path d="M76 31 Q100 36 124 31" fill="none" stroke="{accentDark}" stroke-width="5"/><ellipse cx="100" cy="43" rx="44" ry="8" fill="{accent}" ${O}/>` },
  { id: 'cape.sail', layer: 'cape', name: 'Парус', requiredLevel: 3, premium: true, collection: 'summer', back:
    `<path d="M76 103 L124 103 L151 212 Q125 208 100 188 Q75 208 49 212 Z" fill="{accent}" ${O}/><path d="M68 157 Q100 176 132 157 M60 189 Q81 186 90 176 M140 189 Q119 186 110 176" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>`, front: CLASPS },
  { id: 'aura.sunshine', layer: 'aura', name: 'Солнечные блики', requiredLevel: 5, premium: true, collection: 'summer', back:
    `<circle cx="100" cy="108" r="91" fill="#ffd23f" opacity="0.18"/>` + [[27, 45, -35], [173, 45, 35], [14, 108, 90], [186, 108, 90], [28, 181, 35], [172, 181, -35]].map(([x, y, r]) => `<rect x="${x - 3}" y="${y - 9}" width="6" height="18" rx="3" transform="rotate(${r} ${x} ${y})" fill="#ffd23f" stroke="{outline}" stroke-width="2"/>`).join('') },

  { id: 'color.ochre', layer: 'color', name: 'Охра', requiredLevel: 1, premium: true, collection: 'autumn', color: '#c57930' },
  { id: 'emblem.maple', layer: 'emblem', name: 'Кленовый лист', requiredLevel: 1, premium: true, collection: 'autumn', front: BADGE + leaf(100, 123, 0.65) },
  { id: 'suit.harvest', layer: 'suit', name: 'Осенний дозор', requiredLevel: 2, premium: true, collection: 'autumn', front:
    `<path d="M79 103 L100 114 L121 103 L121 150 L79 150 Z" fill="{accent}" ${O}/><path d="M79 129 L100 143 L121 129 M100 114 L100 149" fill="none" stroke="{accentDark}" stroke-width="3"/><circle cx="100" cy="142" r="3" fill="#ffd23f" stroke="{outline}" stroke-width="1.5"/><path d="M80 174 L94 174 L94 184 L80 184 Z M106 174 L120 174 L120 184 L106 184 Z" fill="{accent}" ${O}/>` },
  { id: 'mask.leafCrown', layer: 'mask', name: 'Венок листьев', requiredLevel: 2, premium: true, collection: 'autumn', overHair: true, front:
    `<path d="M64 42 Q100 24 136 42" fill="none" stroke="{outline}" stroke-width="6" stroke-linecap="round"/>` + leaf(73, 36, 0.8, -30) + leaf(100, 29, 0.9) + leaf(127, 36, 0.8, 30) },
  { id: 'cape.autumn', layer: 'cape', name: 'Листопад', requiredLevel: 3, premium: true, collection: 'autumn', back:
    `<path d="M76 103 L124 103 L151 218 L133 211 L120 228 L100 216 L80 228 L67 211 L49 218 Z" fill="{accent}" ${O}/>` + leaf(63, 190, 0.65, -25) + leaf(137, 190, 0.65, 25), front: CLASPS },
  { id: 'aura.leafDance', layer: 'aura', name: 'Танец листьев', requiredLevel: 5, premium: true, collection: 'autumn', back:
    [[30, 46, -25], [166, 41, 30], [17, 112, -45], [181, 120, 55], [30, 185, 15], [171, 196, -20]].map(([x, y, r]) => leaf(x, y, 0.7, r)).join('') },

  { id: 'color.ice', layer: 'color', name: 'Лёд', requiredLevel: 1, premium: true, collection: 'winter', color: '#9bd7ed' },
  { id: 'emblem.iceCrystal', layer: 'emblem', name: 'Ледяной кристалл', requiredLevel: 1, premium: true, collection: 'winter', front: BADGE + `<path d="M100 113 L108 121 L104 132 L96 132 L92 121 Z M100 113 L96 121 L100 132 L104 121 Z M92 121 L108 121" fill="#9bd7ed" stroke="{outline}" stroke-width="1.5" stroke-linejoin="round"/>` },
  { id: 'suit.frost', layer: 'suit', name: 'Полярный', requiredLevel: 2, premium: true, collection: 'winter', front:
    `<path d="M79 103 Q100 114 121 103 L121 151 L79 151 Z" fill="{accent}" ${O}/><path d="M82 118 L118 118 M80 137 L120 137 M100 111 L100 150" fill="none" stroke="{accentDark}" stroke-width="2.5"/><path d="M76 103 Q100 113 124 103" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/><path d="M78 184 L96 184 M104 184 L122 184" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>` },
  { id: 'mask.winterHat', layer: 'mask', name: 'Зимняя шапка', requiredLevel: 2, premium: true, collection: 'winter', hidesHair: true, front:
    `<path d="M65 49 Q63 20 100 20 Q137 20 135 49 Z" fill="{accent}" ${O}/><path d="M80 43 Q80 28 91 24 M109 24 Q120 28 120 43" fill="none" stroke="{accentDark}" stroke-width="3"/><rect x="63" y="44" width="74" height="12" rx="5" fill="#ffffff" ${O}/><circle cx="100" cy="14" r="9" fill="#ffffff" ${O}/>` },
  { id: 'cape.snow', layer: 'cape', name: 'Снежная мантия', requiredLevel: 3, premium: true, collection: 'winter', back:
    `<path d="M76 103 L124 103 L151 219 Q100 235 49 219 Z" fill="{accent}" ${O}/><path d="M51 213 Q63 220 74 216 Q86 227 100 220 Q114 227 126 216 Q137 220 149 213 L151 219 Q100 235 49 219 Z" fill="#ffffff" ${O}/>` + snow(64, 189, 0.65) + snow(136, 189, 0.65), front: CLASPS },
  { id: 'aura.snowfall', layer: 'aura', name: 'Снегопад', requiredLevel: 5, premium: true, collection: 'winter', back:
    [[32, 40], [168, 43], [18, 106], [182, 112], [30, 178], [170, 192]].map(([x, y]) => snow(x, y, 0.85)).join('') + '<circle cx="53" cy="19" r="3" fill="#9bd7ed"/><circle cx="147" cy="22" r="3" fill="#9bd7ed"/><circle cx="16" cy="152" r="3" fill="#9bd7ed"/><circle cx="184" cy="66" r="3" fill="#9bd7ed"/>' },
];
