import { DEFAULT_HERO, HERO_PARTS_BY_ID, HERO_SLOTS, type HeroPartDef, type HeroParts, type HeroSlot } from './catalog.js';
import { renderPetFragment } from './pets.js';

const OUTLINE = '#1b1f4b';
const O = `stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

/** Ноги, ботинки и торс — общая основа для всех героев */
const BASE_BODY =
  `<path d="M76 154 L98 154 L97 204 L77 204 Z" fill="{suit}" ${O}/>` +
  `<path d="M102 154 L124 154 L123 204 L103 204 Z" fill="{suit}" ${O}/>` +
  `<path d="M75 194 L99 194 L99 213 Q99 220 92 220 L71 220 Q66 220 68 213 Z" fill="{accent}" ${O}/>` +
  `<path d="M101 194 L125 194 L132 213 Q134 220 129 220 L108 220 Q101 220 101 213 Z" fill="{accent}" ${O}/>` +
  `<path d="M70 113 Q70 102 82 102 L118 102 Q130 102 130 113 L126 160 L74 160 Z" fill="{suit}" ${O}/>`;

const BASE_HEAD =
  `<rect x="91" y="90" width="18" height="16" rx="4" fill="{skinDark}" ${O}/>` +
  `<circle cx="64" cy="68" r="7" fill="{skin}" ${O}/><circle cx="136" cy="68" r="7" fill="{skin}" ${O}/>` +
  `<ellipse cx="100" cy="64" rx="36" ry="34" fill="{skin}" ${O}/>`;

const EYES =
  `<ellipse cx="86" cy="66" rx="7" ry="8" fill="#ffffff" ${O}/><ellipse cx="114" cy="66" rx="7" ry="8" fill="#ffffff" ${O}/>` +
  `<circle cx="87" cy="67" r="3.8" fill="${OUTLINE}"/><circle cx="115" cy="67" r="3.8" fill="${OUTLINE}"/>` +
  `<circle cx="88.4" cy="65.3" r="1.3" fill="#ffffff"/><circle cx="116.4" cy="65.3" r="1.3" fill="#ffffff"/>`;

const MOUTH =
  `<circle cx="77" cy="80" r="5" fill="#ff7a8a" opacity="0.35"/><circle cx="123" cy="80" r="5" fill="#ff7a8a" opacity="0.35"/>` +
  `<path d="M90 83 Q100 91 110 83" fill="none" ${O}/>`;

/** Затемнение цвета #rrggbb на долю amount (0..1) */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Нормализует выбор: неизвестные/неподходящие детали заменяются значениями по умолчанию */
export function normalizeHero(input: unknown): HeroParts {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const result = { ...DEFAULT_HERO };
  for (const [slot, layer] of Object.entries(HERO_SLOTS) as [HeroSlot, string][]) {
    const id = src[slot];
    const part = typeof id === 'string' ? HERO_PARTS_BY_ID.get(id) : undefined;
    if (part && part.layer === layer) result[slot] = part.id;
  }
  return result;
}

function get(id: string): HeroPartDef {
  return HERO_PARTS_BY_ID.get(id)!;
}

/**
 * Собирает SVG героя из слоёв. Возвращает строку <svg> — её можно вставить
 * в страницу, сохранить файлом или отрисовать на сервере.
 */
export function renderHeroSvg(input: unknown, opts: { title?: string; level?: number } = {}): string {
  const h = normalizeHero(input);
  const pose = get(h.pose);
  const suit = get(h.suit);
  const cape = get(h.cape);
  const mask = get(h.mask);
  const emblem = get(h.emblem);
  const hair = get(h.hair);
  const aura = get(h.aura);
  const suitC = get(h.suitColor).color!;
  const accentC = get(h.accentColor).color!;
  const skinC = get(h.skin).color!;
  const hairC = get(h.hairColor).color!;

  const showHair = !mask.hidesHair;
  const layers = [
    aura.back,
    cape.back,
    showHair ? hair.back : '',
    BASE_BODY,
    suit.front,
    emblem.front,
    cape.front,
    pose.front,
    BASE_HEAD,
  ];
  // Порядок лица: маска поверх головы, затем глаза/рот (если маска их не закрывает), затем волосы.
  // Шлемы (hidesHair) рисуются после глаз — визор и «окно» шлема оставляют глаза видимыми.
  // Корона и нимб (overHair) рисуются последними, поверх причёски.
  const face: string[] = [];
  if (!mask.hidesHair && !mask.overHair) face.push(mask.front ?? '');
  if (!mask.hidesEyes) face.push(EYES);
  if (!mask.hidesMouth) face.push(MOUTH);
  if (mask.hidesHair) face.push(mask.front ?? '');
  else if (showHair) face.push(hair.front ?? '');
  if (mask.overHair) face.push(mask.front ?? '');

  const pet = renderPetFragment(h.pet, opts.level);
  const body = [...layers, ...face, pet ? `<g transform="translate(136 162)">${pet}</g>` : '']
    .filter(Boolean)
    .join('')
    .replace(/\{suitDark\}/g, shade(suitC, 0.22))
    .replace(/\{suit\}/g, suitC)
    .replace(/\{accentDark\}/g, shade(accentC, 0.25))
    .replace(/\{accent\}/g, accentC)
    .replace(/\{skinDark\}/g, shade(skinC, 0.12))
    .replace(/\{skin\}/g, skinC)
    .replace(/\{hairDark\}/g, shade(hairC, 0.2))
    .replace(/\{hair\}/g, hairC)
    .replace(/\{outline\}/g, OUTLINE);

  const title = opts.title ? `<title>${escapeXml(opts.title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img">${title}${body}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}
