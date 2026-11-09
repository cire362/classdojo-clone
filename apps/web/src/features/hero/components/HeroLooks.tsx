import { HERO_LOOKS, HERO_PARTS_BY_ID, type HeroPartDef, type HeroParts } from '@heroes/shared';
import { HeroAvatar } from './HeroAvatar';

/** Это сочетания обычных деталей, а не неделимые скины. Примерка сохраняет лицо, волосы и питомца. */
export function HeroLooks({ parts, level, lockOf, onPick }: {
  parts: HeroParts;
  level: number;
  lockOf: (part: HeroPartDef) => number | null;
  onPick: (parts: HeroParts) => void;
}) {
  return <details className="border-y border-line py-3">
    <summary className="cursor-pointer font-semibold">Идеи образов · Искатели</summary>
    <p className="my-3 text-sm text-ink-soft">Примерь сочетание, затем меняй любую вещь. Лицо, волосы и питомец останутся твоими.</p>
    <div className="grid grid-cols-3 gap-2">
      {HERO_LOOKS.map((look) => {
        const required = Math.max(0, ...Object.values(look.parts).map((id) => lockOf(HERO_PARTS_BY_ID.get(id)!) ?? 0));
        return <div key={look.name} className="flex min-w-0 flex-col gap-2">
          <HeroAvatar parts={{ ...parts, ...look.parts }} level={level} className="aspect-[5/6] rounded-xl bg-surface-2" />
          <p className="font-semibold">{look.name}</p>
          <p className="text-xs text-ink-soft">{look.detail}</p>
          <button className="btn btn-secondary btn-sm mt-auto w-full px-2 text-xs" disabled={required > 0}
            onClick={() => onPick({ ...parts, ...look.parts })} aria-label={`Примерить образ «${look.name}»`}>
            {required > 0 ? `С ${required} уровня` : 'Примерить'}
          </button>
        </div>;
      })}
    </div>
  </details>;
}
