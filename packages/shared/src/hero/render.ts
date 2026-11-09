import { DEFAULT_HERO, HERO_PARTS_BY_ID, HERO_SLOTS, type HeroPartDef, type HeroParts, type HeroSlot } from './catalog.js';
import { renderPetFragment } from './pets.js';

import { HERO_INK, HERO_BODY, HERO_HEAD, heroBrows, heroEyes, heroMouth } from './body.js';

const OUTLINE = HERO_INK;

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

function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255]
    .map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('');
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
  // Слои размечены классами для анимации живого героя на сайте (дыхание, моргание, сияние, питомец);
  // без стилей классы ни на что не влияют, поэтому SVG годится и для файлов, и для PDF
  const layers = [
    HERO_BODY,
    suit.front,
    emblem.front ? `<g transform="translate(35 42) scale(.65)">${emblem.front}</g>` : '',
    cape.front,
    pose.front,
  ];
  // Порядок лица: маска поверх головы, затем глаза/рот (если маска их не закрывает), затем волосы.
  // Шлемы (hidesHair) рисуются после глаз — визор и «окно» шлема оставляют глаза видимыми.
  // Корона и нимб (overHair) рисуются последними, поверх причёски.
  const face: string[] = [];
  if (!mask.hidesHair && !mask.overHair) face.push(mask.front ?? '');
  if (!mask.hidesEyes) face.push(heroBrows(h.pose), `<g class="hero-eyes">${heroEyes()}</g>`);
  if (!mask.hidesMouth) face.push(heroMouth(h.pose));
  if (mask.hidesHair) face.push(mask.front ?? '');
  else if (showHair) face.push(hair.front ?? '');
  if (mask.overHair) face.push(mask.front ?? '');

  const pet = renderPetFragment(h.pet, opts.level);
  const body = [
    aura.back ? `<g class="hero-aura">${aura.back}</g>` : '',
    `<g class="hero-body">` +
      `<g transform="translate(6 15) scale(.94 .9)">${cape.back ?? ''}</g>` +
      `<g transform="translate(-12 -4) scale(1.12 1.08)">${showHair ? hair.back ?? '' : ''}</g>` +
      `<g transform="translate(6 15) scale(.94 .9)">${layers.filter(Boolean).join('')}</g>` +
      `<g transform="translate(-12 -4) scale(1.12 1.08)">${HERO_HEAD}${face.join('')}</g></g>`,
    pet ? `<g transform="translate(136 162)"><g class="hero-pet">${pet}</g></g>` : '',
  ]
    .join('')
    .replace(/\{suitLight\}/g, tint(suitC, .34))
    .replace(/\{accentLight\}/g, tint(accentC, .42))
    .replace(/\{skinLight\}/g, tint(skinC, .28))
    .replace(/\{hairLight\}/g, tint(hairC, .25))
    .replace(/\{iris\}/g, shade(accentC, .48))
    .replace(/\{suitDark\}/g, shade(suitC, 0.22))
    .replace(/\{suit\}/g, suitC)
    .replace(/\{accentDark\}/g, shade(accentC, 0.25))
    .replace(/\{accent\}/g, accentC)
    .replace(/\{skinDark\}/g, shade(skinC, 0.12))
    .replace(/\{skin\}/g, skinC)
    .replace(/\{brow\}/g, shade(hairC, 0.5))
    .replace(/\{hairDark\}/g, shade(hairC, 0.2))
    .replace(/\{hair\}/g, hairC)
    .replace(/\{outline\}/g, OUTLINE);

  const title = opts.title ? `<title>${escapeXml(opts.title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img">${title}${body}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}
