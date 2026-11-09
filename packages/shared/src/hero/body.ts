/** Общая анатомия. Прежние точки крепления сохранены: любая старая деталь остаётся совместимой. */
export const HERO_INK = '#303039';
const O = 'stroke="{outline}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';

export const HERO_BODY = `
  <ellipse cx="101" cy="224" rx="40" ry="5" fill="{outline}" opacity=".12"/>
  <path d="M75 151 Q87 147 99 155 L96 202 L76 204 L73 180Z" fill="{suitDark}" ${O}/>
  <path d="M101 155 Q113 148 126 153 L128 179 L124 205 L103 201Z" fill="{suitDark}" ${O}/>
  <path d="M78 162 L94 163 L91 186 L77 185Z M107 163 L122 161 L123 184 L108 186Z" fill="{suit}"/>
  <path d="M79 169 L91 170 M109 170 L121 169" fill="none" stroke="{suitLight}" stroke-width="1.6"/>
  <path d="M75 184 Q85 181 97 186 L96 199 Q87 203 75 198Z M104 187 Q113 182 126 183 L125 198 Q116 203 104 198Z"
    fill="{accentDark}" ${O}/>
  <path d="M78 190 L92 192 M109 192 L121 190" stroke="{accentLight}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M75 197 Q84 200 97 197 L98 213 Q97 220 90 221 L66 221 Q61 215 67 209 L74 206Z" fill="{accent}" ${O}/>
  <path d="M104 197 Q114 200 125 196 L128 207 L136 212 Q140 216 135 220 L110 221 Q102 219 103 212Z" fill="{accent}" ${O}/>
  <path d="M65 216 Q80 219 97 214 L96 221 L66 223Z M104 214 Q119 218 137 214 L136 221 L109 223Z" fill="{outline}"/>
  <path d="M76 204 L90 206 M76 208 L89 210 M110 206 L123 204 M111 210 L124 208" stroke="{accentLight}" stroke-width="2" stroke-linecap="round"/>
  <path d="M71 112 Q70 103 85 101 L114 101 Q130 102 130 114 L127 155 Q112 167 99 163 Q84 167 72 157Z" fill="{suit}" ${O}/>
  <path d="M72 121 Q80 125 79 148 L76 155 L86 161 L74 159Z M124 116 Q119 141 117 160 L127 156Z" fill="{suitDark}"/>
  <path d="M84 106 Q98 109 116 106" stroke="{suitLight}" stroke-width="2" fill="none"/>
  <path d="M84 103 L91 118 L100 110 L109 118 L117 103" fill="{accent}" ${O}/>
  <path d="M100 113 L99 155" fill="none" stroke="{outline}" stroke-width="1.4" opacity=".6"/>
  <path d="M82 137 L92 137 L92 148 L82 148Z M106 137 L117 137 L117 148 L106 148Z" fill="{suitDark}"/>
  <path d="M83 139 L91 139 M107 139 L116 139" stroke="{suitLight}" stroke-width="1.5"/>
`;

/**
 * Голова и лицо симметричны относительно x = 100 — оси масок и причёсок: глаза в центрах прорезей масок
 * (85 и 115), нос и рот по центру. Свет падает слева, поэтому правая щека чуть темнее.
 */
export const HERO_HEAD = `
  <path d="M91 88 L109 88 L109 103 Q100 110 91 103Z" fill="{skinDark}" ${O}/>
  <path d="M92 98 Q100 102 108 98 L108 102 Q100 107 92 102Z" fill="{skin}"/>
  <path d="M65 61 Q54 57 56 70 Q58 77 66 73 M135 61 Q146 57 144 70 Q142 77 134 73" fill="{skin}" ${O}/>
  <path d="M61 64.5 Q58 67 62 70 M139 64.5 Q142 67 138 70" fill="none" stroke="{skinDark}" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 57 Q63 29 100 29 Q137 29 136 57 L134.5 76 Q130 95 100 98.5 Q70 95 65.5 76Z" fill="{skin}" ${O}/>
  <path d="M128 44 Q138 62 130 81 Q122 93 100 96.5 Q125 95 132.5 78 L135 57Z" fill="{skinDark}" opacity=".55"/>
  <path d="M70 60 Q69 43 86 38" fill="none" stroke="{skinLight}" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <path d="M97 77.5 Q100 80 103 77.5" fill="none" stroke="{skinDark}" stroke-width="2" stroke-linecap="round"/>
`;

/**
 * Брови отдельно от глаз: моргание сжимает только глаза. Цвет — заметно темнее волос, чтобы брови читались и на
 * тёмной коже. У уверенных поз брови сведены к переносице.
 */
export function heroBrows(pose: string) {
  const confident = pose === 'pose.flex' || pose === 'pose.fist';
  const d = confident ? 'M78 54.5 Q85 53.5 92 57 M108 57 Q115 53.5 122 54.5' : 'M78 56 Q85 52 92 55 M108 55 Q115 52 122 56';
  return `<path d="${d}" fill="none" stroke="{brow}" stroke-width="2.8" stroke-linecap="round"/>`;
}

/** Глаза одинаковые и смотрят прямо: белок, радужка цвета акцента, зрачок, блик и верхнее веко */
export function heroEyes() {
  return [85, 115].map((x) => `
    <ellipse cx="${x}" cy="66.5" rx="5.8" ry="6.6" fill="#fff9ef" stroke="{outline}" stroke-width="1.5"/>
    <ellipse cx="${x}" cy="67.3" rx="3.9" ry="4.6" fill="{iris}"/>
    <circle cx="${x}" cy="67.6" r="2.3" fill="{outline}"/>
    <circle cx="${x - 1.4}" cy="65.4" r="1.4" fill="#fff"/>
    <path d="M${x - 6.3} 64.6 Q${x} 58.4 ${x + 6.3} 64.6" fill="none" stroke="{outline}" stroke-width="2.3" stroke-linecap="round"/>
  `).join('');
}

/** Рот по центру: спокойная улыбка или, в радостных позах, открытая с зубами */
export function heroMouth(pose: string) {
  const happy = pose === 'pose.victory' || pose === 'pose.wave';
  const mouth = happy
    ? `<path d="M92.5 83 Q100 85 107.5 83 Q106.5 92.5 100 92.5 Q93.5 92.5 92.5 83Z" fill="{outline}" stroke="{outline}"
        stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M94.4 84.2 Q100 85.6 105.6 84.2 L105.1 86.4 Q100 87.4 94.9 86.4Z" fill="#fff9ef"/>
      <path d="M96.5 90.6 Q100 88 103.5 90.6 Q100 92.2 96.5 90.6Z" fill="#d66d63"/>`
    : '<path d="M93.5 84.5 Q100 89.5 106.5 84.5" fill="none" stroke="{outline}" stroke-width="2.2" stroke-linecap="round"/>';
  return `
    <ellipse cx="78.5" cy="78.5" rx="5.5" ry="3" fill="#d66d63" opacity=".22"/>
    <ellipse cx="121.5" cy="78.5" rx="5.5" ry="3" fill="#d66d63" opacity=".22"/>
    ${mouth}
  `;
}
