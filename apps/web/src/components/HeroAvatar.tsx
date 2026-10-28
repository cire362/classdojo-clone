import { memo, useMemo } from 'react';
import { HERO_PARTS_BY_ID, normalizeHero, renderHeroSvg, type HeroParts } from '@heroes/shared';

/**
 * SVG собирается из собственного каталога деталей (без пользовательского ввода),
 * поэтому вставка разметки безопасна. crop="head" — портрет для списков.
 */
export const HeroAvatar = memo(function HeroAvatar({
  parts,
  title,
  className = '',
  crop = 'full',
}: {
  parts: HeroParts | Record<string, string>;
  title?: string;
  className?: string;
  crop?: 'full' | 'head';
}) {
  const svg = useMemo(() => {
    // Подпись даёт обёртка; у самого svg роль не нужна
    const full = renderHeroSvg(parts).replace(' role="img"', ' aria-hidden="true" focusable="false"');
    return crop === 'head' ? full.replace('viewBox="0 0 200 240"', 'viewBox="38 8 124 124"') : full;
  }, [parts, crop]);
  // Без подписи герой — просто украшение рядом с именем, экранный диктор его пропускает
  return title ? (
    <div className={`hero-avatar ${className}`} role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className={`hero-avatar ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  );
});

/** Мягкий фон карточки в тон костюму героя */
export function heroTint(parts: HeroParts | Record<string, string>, amount = 16): string {
  const color = HERO_PARTS_BY_ID.get(normalizeHero(parts).suitColor)?.color ?? '#888888';
  return `color-mix(in srgb, ${color} ${amount}%, var(--surface-2))`;
}

export function HeroHead({ parts, className = 'size-12' }: { parts: HeroParts | Record<string, string>; className?: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-full ${className}`} style={{ background: heroTint(parts, 22) }}>
      <HeroAvatar parts={parts} crop="head" className="size-full" />
    </span>
  );
}
