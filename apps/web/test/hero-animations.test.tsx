import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { DEFAULT_HERO, renderHeroSvg } from '@heroes/shared';
import { HeroAvatar } from '../src/features/hero';

it('слои героя размечены для анимации: тело, глаза, сияние и питомец', () => {
  const svg = renderHeroSvg({ ...DEFAULT_HERO, aura: 'aura.glow', pet: 'pet.fox' }, { level: 4 });
  for (const part of ['hero-body', 'hero-eyes', 'hero-aura', 'hero-pet']) expect(svg).toContain(`class="${part}"`);
  // Без сияния и питомца пустых групп нет
  const plain = renderHeroSvg({ ...DEFAULT_HERO, pet: 'pet.none' });
  expect(plain).not.toContain('hero-aura');
  expect(plain).not.toContain('hero-pet');
});

it('живым становится только герой с alive: в списках и карточках анимаций нет', () => {
  const { container, rerender } = render(<HeroAvatar parts={DEFAULT_HERO} alive className="big" />);
  expect(container.firstElementChild).toHaveClass('hero-avatar', 'hero-alive', 'big');
  rerender(<HeroAvatar parts={DEFAULT_HERO} className="card" />);
  expect(container.firstElementChild).not.toHaveClass('hero-alive');
});
