import { fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DEFAULT_HERO, HERO_LOOKS, HERO_PARTS, HERO_PARTS_BY_ID, HERO_SLOTS, normalizeHero, renderHeroSvg } from '@heroes/shared';
import { HeroLooks } from '../src/features/hero/components/HeroLooks';
import { renderApp } from './render';

it('все старые и новые детали образуют корректный автономный SVG, без внешних ссылок и повторяемых id', () => {
  for (const part of HERO_PARTS) {
    const slot = Object.entries(HERO_SLOTS).find(([, layer]) => layer === part.layer)![0];
    const parts = { ...DEFAULT_HERO, [slot]: part.id };
    expect(normalizeHero(parts)).toEqual(parts);
    const svg = renderHeroSvg(parts, { level: 10, title: '<Герой & друг>' });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror'), part.id).toBeNull();
    expect(doc.querySelector('title')?.textContent).toBe('<Герой & друг>');
    expect(svg).not.toMatch(/undefined|NaN|\{[a-zA-Z]+\}/);
    expect(doc.querySelector('script, image, use, foreignObject, [id]')).toBeNull();
  }
});

it('примеры состоят из реальных совместимых деталей, а новые вещи открываются постепенно', () => {
  for (const look of HERO_LOOKS) {
    for (const [slot, id] of Object.entries(look.parts)) {
      expect(HERO_PARTS_BY_ID.get(id)?.layer, id).toBe(HERO_SLOTS[slot as keyof typeof HERO_SLOTS]);
    }
  }
  const parts = HERO_PARTS.filter((p) => p.collection === 'expedition');
  expect(new Set(parts.map((p) => p.requiredLevel))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
});

it('примерка не меняет лицо и питомца, а недоступный образ не применяет вещи раньше уровня', () => {
  const onPick = vi.fn();
  const parts = { ...DEFAULT_HERO, skin: 'skin.5', hair: 'hair.buns', pet: 'pet.fox' };
  renderApp(<HeroLooks parts={parts} level={2}
    lockOf={(p) => p.requiredLevel > 2 ? p.requiredLevel : null} onPick={onPick} />);
  fireEvent.click(screen.getByText('Идеи образов · Искатели'));
  fireEvent.click(screen.getByRole('button', { name: 'Примерить образ «Следопыт»' }));
  expect(onPick).toHaveBeenCalledWith({ ...parts, ...HERO_LOOKS[0].parts });
  expect(screen.getByRole('button', { name: 'Примерить образ «Навигатор»' })).toBeDisabled();
});
