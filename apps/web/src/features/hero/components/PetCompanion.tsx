import { PawPrintIcon } from '@phosphor-icons/react';
import { HERO_PARTS_BY_ID, normalizeHero, petStageForLevel, renderPetSvg, type HeroParts } from '@heroes/shared';
import { useHeroes } from '../../auth';

export function PetAvatar({ petId, level, className = '' }: { petId: string; level: number; className?: string }) {
  // Самостоятельное SVG-превью использует тот же рисунок, что и компаньон рядом с героем.
  return <span className={`hero-avatar block aspect-square ${className}`} aria-hidden dangerouslySetInnerHTML={{ __html: renderPetSvg(petId, level) }} />;
}

export function PetCompanion({ parts, level }: { parts: HeroParts; level: number }) {
  const heroes = useHeroes();
  const pet = HERO_PARTS_BY_ID.get(normalizeHero(parts).pet);
  if (!heroes || !pet || pet.id === 'pet.none') return null;
  const stage = petStageForLevel(level);
  return (
    <div role="group" className="flex items-center gap-3" aria-label="Питомец героя">
      <PawPrintIcon size={24} className="shrink-0 text-ink-soft" aria-hidden />
      <div>
        <p className="text-sm font-semibold">{pet.name} <span className="font-normal text-ink-soft">· {stage.title}</span></p>
        <p className="mt-0.5 text-xs text-ink-soft">{stage.nextLevel ? `Следующая стадия — на ${stage.nextLevel}-м уровне героя.` : 'Питомец достиг последней стадии роста.'}</p>
      </div>
    </div>
  );
}
