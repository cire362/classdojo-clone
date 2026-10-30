import { useMemo, useRef, useState } from 'react';
import { DiceFiveIcon, LockSimpleIcon, MinusCircleIcon, PawPrintIcon, SparkleIcon } from '@phosphor-icons/react';
import {
  HERO_SLOT_LABELS,
  HERO_SLOTS,
  HERO_COLLECTIONS,
  type HeroCollectionId,
  partsForLayer,
  normalizeHero,
  PET_STAGES,
  petStageForLevel,
  type HeroLayer,
  type HeroParts,
  type HeroPartDef,
  type HeroSlot,
} from '@heroes/shared';
import { api } from '../api';
import { useLoad } from '../hooks';
import { HeroAvatar } from './HeroAvatar';
import { useToast } from './Toast';
import { PetAvatar } from './PetCompanion';

const SWATCH_LAYERS: HeroLayer[] = ['color', 'skin', 'hairColor'];
const SLOTS = Object.keys(HERO_SLOTS) as HeroSlot[];

interface PartAccess {
  id: string;
  requiredLevel: number;
  isPremium: boolean;
}

export function HeroEditor({
  initial,
  level,
  onSave,
  ownerLabel,
  newIds,
  premium = false,
}: {
  initial: { name: string; parts: HeroParts };
  level: number;
  /** Открыта ли премиум-коллекция (премиум у создателя группы) */
  premium?: boolean;
  onSave: (name: string, parts: HeroParts) => Promise<void>;
  ownerLabel?: string;
  /** Детали, открывшиеся с прошлого визита: помечаются «новое» */
  newIds?: Set<string>;
}) {
  const toast = useToast();
  const initialParts = useMemo(() => normalizeHero(initial.parts), [initial.parts]);
  const [parts, setParts] = useState<HeroParts>(initialParts);
  const petTab = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(initial.name);
  const slotHasNew = (s: HeroSlot) => !!newIds?.size && partsForLayer(HERO_SLOTS[s]).some((p) => newIds.has(p.id));
  const [slot, setSlot] = useState<HeroSlot>('pose');
  const [collection, setCollection] = useState<'all' | 'base' | HeroCollectionId>('all');
  const [autoSlot, setAutoSlot] = useState(false);
  // Открываем первую вкладку, где есть новые детали
  if (!autoSlot && newIds) {
    setAutoSlot(true);
    const first = SLOTS.find(slotHasNew);
    if (first) setSlot(first);
  }
  const [saving, setSaving] = useState(false);
  const access = useLoad(() => api<PartAccess[]>('GET', '/hero-parts'), []);
  const accessById = useMemo(() => new Map(access.data?.map((p) => [p.id, p])), [access.data]);

  const isPremiumPart = (p: HeroPartDef) => accessById.get(p.id)?.isPremium ?? !!p.premium;
  /** Замок: номер уровня, на котором деталь откроется, или 'premium' — нужна премиум-коллекция */
  const lockOf = (p: HeroPartDef): number | 'premium' | null => {
    if (isPremiumPart(p) && !premium) return 'premium';
    const required = accessById.get(p.id)?.requiredLevel ?? p.requiredLevel;
    return required > level ? required : null;
  };

  const dirty = name !== initial.name || SLOTS.some((s) => parts[s] !== initialParts[s]);
  const inCollection = (p: HeroPartDef) => collection === 'all' || (collection === 'base' ? !p.collection : p.collection === collection);
  const options = partsForLayer(HERO_SLOTS[slot]).filter(inCollection);
  const selectedCollection = HERO_COLLECTIONS.find((c) => c.id === collection);
  const isSwatch = SWATCH_LAYERS.includes(HERO_SLOTS[slot]);
  const petStage = petStageForLevel(level);

  function pick(p: HeroPartDef) {
    const lock = lockOf(p);
    if (lock !== null) {
      toast({ text: lock === 'premium' ? 'Деталь из премиум-коллекции: откроется, когда преподаватель подключит премиум' : `Откроется на ${lock} уровне`, tone: 'neutral' });
      return;
    }
    setParts({ ...parts, [slot]: p.id });
  }

  function randomize() {
    const next = { ...parts };
    for (const s of SLOTS) {
      const open = partsForLayer(HERO_SLOTS[s]).filter((p) => lockOf(p) === null);
      if (open.length) next[s] = open[Math.floor(Math.random() * open.length)].id;
    }
    setParts(next);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(name.trim(), parts);
      toast({ text: 'Герой сохранён', tone: 'ok' });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
        <div className="relative mx-auto max-w-[320px] rounded-2xl bg-surface-2 px-6 pt-4 lg:max-w-none">
          <div key={JSON.stringify(parts)} className="anim-pop">
            <HeroAvatar parts={parts} level={level} title={name || 'Герой'} className="mx-auto aspect-[5/6] max-w-[300px]" />
          </div>
          <button className="icon-btn absolute right-2 top-2 bg-surface" onClick={randomize} aria-label="Случайный герой" title="Случайный герой">
            <DiceFiveIcon size={22} />
          </button>
        </div>
        <button className="btn btn-secondary w-full" onClick={() => {
          setSlot('pet');
          setCollection('all');
          petTab.current?.focus();
          petTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        }}>
          <PawPrintIcon size={20} aria-hidden /> {parts.pet === 'pet.none' ? 'Выбрать питомца' : 'Изменить питомца'}
        </button>
        <div>
          <label className="label" htmlFor="hero-name">
            Имя героя{ownerLabel ? ` (${ownerLabel})` : ''}
          </label>
          <input
            id="hero-name"
            className="input font-display"
            placeholder="Например, Капитан Дробь"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-lg w-full" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Сохраняем…' : dirty ? 'Сохранить героя' : 'Сохранено'}
        </button>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <label className="label" htmlFor="hero-collection">Коллекция</label>
          <select id="hero-collection" className="input max-w-sm" value={collection} onChange={(e) => {
            const next = e.target.value as typeof collection;
            setCollection(next);
            const matches = (p: HeroPartDef) => next === 'all' || (next === 'base' ? !p.collection : p.collection === next);
            if (!partsForLayer(HERO_SLOTS[slot]).some(matches)) {
              const first = SLOTS.find((s) => partsForLayer(HERO_SLOTS[s]).some(matches));
              if (first) setSlot(first);
            }
          }}>
            <option value="all">Все детали</option>
            <option value="base">Основная коллекция</option>
            {HERO_COLLECTIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="mt-2 text-sm text-ink-soft">{selectedCollection ? `${selectedCollection.description} Можно носить круглый год и сочетать с другими коллекциями.` : 'Сочетай детали любых коллекций. Выбор коллекции фильтрует список, сохраняя твоего героя.'}</p>
        </div>
        <nav className="relative -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Детали героя">
          {SLOTS.map((s) => (
            <button key={s} ref={s === 'pet' ? petTab : undefined} className={`tab ${slot === s ? 'active' : 'bg-surface-2'}`} onClick={() => setSlot(s)} aria-pressed={slot === s}>
              {HERO_SLOT_LABELS[s]}
              {slotHasNew(s) && <span className="size-2 rounded-full bg-accent" aria-label="есть новые детали" />}
            </button>
          ))}
        </nav>

        {slot === 'pet' && <section aria-label="Рост питомца" className="space-y-3">
          <div>
            <h2 className="font-sans text-lg font-semibold">Питомец героя</h2>
            <p className="mt-1 text-sm text-ink-soft">Выбери компаньона. На 4-м и 7-м уровнях героя он вырастет и изменится.</p>
          </div>
          <ol className="flex flex-wrap gap-2 text-xs">
            {PET_STAGES.map((s) => <li key={s.level} aria-current={petStage.title === s.title ? 'step' : undefined} className={`rounded-full px-3 py-1.5 ${petStage.title === s.title ? 'bg-accent font-semibold text-on-accent' : 'bg-surface-2 text-ink-soft'}`}>{s.level}-й уровень · {s.title}</li>)}
          </ol>
        </section>}
        {options.length === 0 && <div className="space-y-3 rounded-2xl border border-dashed border-line p-4">
          <p className="text-sm text-ink-soft">В этой коллекции нет деталей для раздела «{HERO_SLOT_LABELS[slot]}». Выбери другой раздел или покажи все детали.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => setCollection('all')}>Показать все детали</button>
        </div>}
        <div
          className={
            slot === 'pet' ? 'grid grid-cols-2 gap-3 sm:grid-cols-4' : isSwatch
              ? 'grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-3'
              : 'grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]'
          }
        >
          {options.map((p) => {
            const lock = lockOf(p);
            const premiumPart = isPremiumPart(p);
            const collectionName = HERO_COLLECTIONS.find((c) => c.id === p.collection)?.name;
            const active = parts[slot] === p.id;
            const isNew = !!newIds?.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => pick(p)}
                aria-pressed={active}
                className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-center transition active:scale-[0.97] ${
                  active ? 'border-ink bg-accent/20 ring-2 ring-ink' : 'border-line bg-surface hover:border-ink-soft'
                }`}
              >
                {slot === 'pet' ? (
                  <span className="flex aspect-square w-full items-center justify-center rounded-xl bg-[#f4efdf] p-2">
                    {p.id === 'pet.none' ? <MinusCircleIcon size={40} className="text-[#1b1f4b]" aria-hidden /> : <PetAvatar petId={p.id} level={level} className="size-full" />}
                  </span>
                ) : isSwatch ? (
                  <span className="mt-1 size-12 rounded-full ring-1 ring-line" style={{ background: p.color }} />
                ) : (
                  <span className="block w-full overflow-hidden rounded-xl bg-surface-2">
                    <HeroAvatar parts={{ ...parts, [slot]: p.id }} level={level} className={`aspect-[5/6] w-full ${lock ? 'opacity-35 grayscale' : ''}`} />
                  </span>
                )}
                <span className={`text-xs font-medium leading-tight ${lock ? 'text-ink-soft' : ''}`}>
                  {p.name}
                  {collectionName && <span className="sr-only">, коллекция «{collectionName}»</span>}
                  {lock !== null && <span className="sr-only">{lock === 'premium' ? ', недоступна без премиума' : `, откроется на ${lock} уровне`}</span>}
                  {isNew && <span className="sr-only">, новое</span>}
                </span>
                {isNew && (
                  <span aria-hidden className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-on-accent">
                    новое
                  </span>
                )}
                {lock !== null && (
                  <span aria-hidden className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-bold text-bg">
                    <LockSimpleIcon size={11} weight="bold" />
                    {lock === 'premium' ? '' : lock}
                  </span>
                )}
                {premiumPart && (
                  <span aria-hidden className="absolute bottom-[1.9rem] right-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#2a2470] px-1.5 py-0.5 text-[11px] font-bold text-white">
                    <SparkleIcon size={11} weight="fill" /> {collectionName ?? 'премиум'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-ink-soft">
          Детали с замком открываются на новых уровнях. Уровень растёт от заработанных баллов.
          {premium ? ' Коллекции «Космос», «Весна», «Лето», «Осень» и «Зима» доступны по уровню.' : ' Тематические коллекции открываются, если преподаватель подключит премиум.'}
        </p>
      </div>
    </div>
  );
}
