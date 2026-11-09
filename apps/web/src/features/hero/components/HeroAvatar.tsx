import { memo, useMemo } from 'react';
import { HERO_PARTS_BY_ID, normalizeHero, renderHeroSvg, type HeroParts } from '@heroes/shared';
import { useHeroes } from '../../auth';

/**
 * SVG собирается из собственного каталога деталей (без пользовательского ввода),
 * поэтому вставка разметки безопасна. crop="head" — портрет для списков.
 * alive — живой герой: дышит, моргает, питомец покачивается. Только для крупного героя, не в списках:
 * десятки одновременных анимаций на экране урока отвлекали бы и грузили слабые устройства.
 */
export const HeroAvatar = memo(function HeroAvatar({
  parts,
  title,
  className = '',
  crop = 'full',
  level = 1,
  alive = false,
}: {
  parts: HeroParts | Record<string, string>;
  title?: string;
  className?: string;
  crop?: 'full' | 'head';
  level?: number;
  alive?: boolean;
}) {
  const heroes = useHeroes();
  const svg = useMemo(() => {
    // Подпись даёт обёртка; у самого svg роль не нужна
    const full = renderHeroSvg(parts, { level }).replace(' role="img"', ' aria-hidden="true" focusable="false"');
    return crop === 'head' ? full.replace('viewBox="0 0 200 240"', 'viewBox="38 8 124 124"') : full;
  }, [parts, crop, level]);
  // Герои выключены: вместо героя нейтральная плашка, место в раскладке то же. Без значка: иконка, нужная двум
  // файлам, попала бы в ядро приложения (+3 КБ), а имя и так подписано рядом
  if (!heroes) return <div className={`hero-avatar rounded-xl bg-surface-2 ${className}`} aria-hidden="true" />;
  // Без подписи герой — просто украшение рядом с именем, экранный диктор его пропускает
  const classes = `hero-avatar ${alive ? 'hero-alive ' : ''}${className}`;
  return title ? (
    <div className={classes} role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className={classes} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
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
