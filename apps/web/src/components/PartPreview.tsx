import { HERO_PARTS_BY_ID, type HeroLayer, type HeroParts, type HeroSlot } from '@heroes/shared';
import { HeroAvatar } from './HeroAvatar';

/** В какой слот героя «примерять» деталь данного слоя для превью */
export const LAYER_PREVIEW_SLOT: Record<HeroLayer, HeroSlot> = {
  pose: 'pose',
  suit: 'suit',
  mask: 'mask',
  cape: 'cape',
  emblem: 'emblem',
  hair: 'hair',
  color: 'suitColor',
  skin: 'skin',
  hairColor: 'hairColor',
  aura: 'aura',
};

/** Мини-превью детали: свой герой с этой деталью или образец цвета */
export function PartPreview({ partId, base, className = '' }: { partId: string; base: HeroParts; className?: string }) {
  const part = HERO_PARTS_BY_ID.get(partId);
  if (!part) return null;
  return (
    <figure className={`flex flex-col items-center gap-1.5 ${className}`}>
      {part.color ? (
        <span className="flex aspect-[5/6] w-full items-center justify-center rounded-xl bg-surface-2">
          <span className="size-10 rounded-full ring-1 ring-line" style={{ background: part.color }} />
        </span>
      ) : (
        <span className="block w-full overflow-hidden rounded-xl bg-surface-2">
          <HeroAvatar parts={{ ...base, [LAYER_PREVIEW_SLOT[part.layer]]: part.id }} className="aspect-[5/6] w-full" />
        </span>
      )}
      <figcaption className="text-center text-xs font-medium leading-tight">{part.name}</figcaption>
    </figure>
  );
}
