import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO, HERO_COLLECTIONS, HERO_PARTS, HERO_SLOTS, MAX_LEVEL, normalizeHero, randomHero, renderHeroSvg } from '@heroes/shared';

describe('каталог деталей героя', () => {
  it('id уникальны и имеют вид <слой>.<ключ>', () => {
    const ids = HERO_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of HERO_PARTS) expect(p.id.startsWith(`${p.layer}.`)).toBe(true);
  });

  it('у каждого слота есть деталь 1 уровня, а детали по умолчанию открыты сразу', () => {
    for (const [slot, layer] of Object.entries(HERO_SLOTS)) {
      expect(HERO_PARTS.some((p) => p.layer === layer && p.requiredLevel === 1), slot).toBe(true);
      const def = HERO_PARTS.find((p) => p.id === DEFAULT_HERO[slot as keyof typeof DEFAULT_HERO])!;
      expect(def.layer).toBe(layer);
      expect(def.requiredLevel).toBe(1);
    }
  });

  it('на каждом уровне со 2-го по последний что-то открывается, на 6–10 не меньше четырёх деталей', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      const n = HERO_PARTS.filter((p) => p.requiredLevel === level).length;
      expect(n, `уровень ${level}`).toBeGreaterThan(0);
      if (level >= 6) expect(n, `уровень ${level}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('все детали рисуются без неподставленных плейсхолдеров', () => {
    for (const p of HERO_PARTS) {
      const slot = Object.entries(HERO_SLOTS).find(([, l]) => l === p.layer)![0];
      const svg = renderHeroSvg({ ...DEFAULT_HERO, [slot]: p.id });
      expect(svg, p.id).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(svg, p.id).not.toContain('undefined');
    }
  });

  it('старый герой без новых слотов дополняется значениями по умолчанию', () => {
    const { aura: _omit, ...old } = DEFAULT_HERO;
    expect(normalizeHero(old).aura).toBe('aura.none');
    const r = randomHero();
    expect(HERO_PARTS.find((p) => p.id === r.aura)!.requiredLevel).toBe(1);
  });

  it('каждый сезон имеет шесть совместимых деталей, а прежние особые детали относятся к Космосу', () => {
    const ids = new Set(HERO_COLLECTIONS.map((c) => c.id));
    for (const p of HERO_PARTS) {
      if (p.themed) expect(ids.has(p.collection!)).toBe(true);
      if (p.collection) expect(p.themed).toBe(true);
    }
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      const items = HERO_PARTS.filter((p) => p.collection === season);
      expect(items).toHaveLength(6);
      expect(new Set(items.map((p) => p.layer))).toEqual(new Set(['suit', 'mask', 'cape', 'emblem', 'aura', 'color']));
      expect(items.map((p) => p.requiredLevel)).toEqual(expect.arrayContaining([1, 2, 3, 5]));
    }
    expect(HERO_PARTS.find((p) => p.id === 'emblem.diamond')?.collection).toBe('cosmos');
    expect(HERO_PARTS.find((p) => p.id === 'emblem.sun')).toMatchObject({ name: 'Солнце', requiredLevel: 3 });
    expect(HERO_PARTS.find((p) => p.id === 'emblem.sun')?.themed).not.toBe(true);
    expect(HERO_PARTS.find((p) => p.id === 'emblem.snowflake')?.themed).not.toBe(true);
  });
});
