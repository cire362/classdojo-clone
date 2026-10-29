import { useMemo, useState } from 'react';
import { DiceFiveIcon, LockSimpleIcon } from '@phosphor-icons/react';
import {
  HERO_SLOT_LABELS,
  HERO_SLOTS,
  partsForLayer,
  type HeroLayer,
  type HeroParts,
  type HeroPartDef,
  type HeroSlot,
} from '@heroes/shared';
import { api } from '../api';
import { useLoad } from '../hooks';
import { HeroAvatar } from './HeroAvatar';
import { useToast } from './Toast';

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
}: {
  initial: { name: string; parts: HeroParts };
  level: number;
  onSave: (name: string, parts: HeroParts) => Promise<void>;
  ownerLabel?: string;
  /** Детали, открывшиеся с прошлого визита: помечаются «новое» */
  newIds?: Set<string>;
}) {
  const toast = useToast();
  const [parts, setParts] = useState<HeroParts>(initial.parts);
  const [name, setName] = useState(initial.name);
  const slotHasNew = (s: HeroSlot) => !!newIds?.size && partsForLayer(HERO_SLOTS[s]).some((p) => newIds.has(p.id));
  const [slot, setSlot] = useState<HeroSlot>('pose');
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

  const lockLevel = (p: HeroPartDef): number | null => {
    const a = accessById.get(p.id);
    const required = a?.requiredLevel ?? p.requiredLevel;
    if (a?.isPremium) return Infinity;
    return required > level ? required : null;
  };

  const dirty = name !== initial.name || SLOTS.some((s) => parts[s] !== initial.parts[s]);
  const options = partsForLayer(HERO_SLOTS[slot]);
  const isSwatch = SWATCH_LAYERS.includes(HERO_SLOTS[slot]);

  function pick(p: HeroPartDef) {
    const lock = lockLevel(p);
    if (lock !== null) {
      toast({ text: lock === Infinity ? 'Эта деталь пока недоступна' : `Откроется на ${lock} уровне`, tone: 'neutral' });
      return;
    }
    setParts({ ...parts, [slot]: p.id });
  }

  function randomize() {
    const next = { ...parts };
    for (const s of SLOTS) {
      const open = partsForLayer(HERO_SLOTS[s]).filter((p) => lockLevel(p) === null);
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
            <HeroAvatar parts={parts} title={name || 'Герой'} className="mx-auto aspect-[5/6] max-w-[300px]" />
          </div>
          <button className="icon-btn absolute right-2 top-2 bg-surface" onClick={randomize} aria-label="Случайный герой" title="Случайный герой">
            <DiceFiveIcon size={22} />
          </button>
        </div>
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
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Детали героя">
          {SLOTS.map((s) => (
            <button key={s} className={`tab ${slot === s ? 'active' : 'bg-surface-2'}`} onClick={() => setSlot(s)} aria-pressed={slot === s}>
              {HERO_SLOT_LABELS[s]}
              {slotHasNew(s) && <span className="size-2 rounded-full bg-accent" aria-label="есть новые детали" />}
            </button>
          ))}
        </nav>

        <div
          className={
            isSwatch
              ? 'grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-3'
              : 'grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]'
          }
        >
          {options.map((p) => {
            const lock = lockLevel(p);
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
                {isSwatch ? (
                  <span className="mt-1 size-12 rounded-full ring-1 ring-line" style={{ background: p.color }} />
                ) : (
                  <span className="block w-full overflow-hidden rounded-xl bg-surface-2">
                    <HeroAvatar parts={{ ...parts, [slot]: p.id }} className={`aspect-[5/6] w-full ${lock ? 'opacity-35 grayscale' : ''}`} />
                  </span>
                )}
                <span className={`text-xs font-medium leading-tight ${lock ? 'text-ink-soft' : ''}`}>
                  {p.name}
                  {lock !== null && <span className="sr-only">, откроется {lock === Infinity ? 'позже' : `на ${lock} уровне`}</span>}
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
                    {lock === Infinity ? '' : lock}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-ink-soft">Детали с замком открываются на новых уровнях. Уровень растёт от заработанных баллов.</p>
      </div>
    </div>
  );
}
