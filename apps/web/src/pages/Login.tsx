import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_HERO, type HeroParts } from '@heroes/shared';
import { useAuth } from '../features/accounts';
import { HeroAvatar } from '../components/HeroAvatar';

const h = (p: Partial<HeroParts>): HeroParts => ({ ...DEFAULT_HERO, ...p });

/** Слайды витрины: по три героя, включая детали старших уровней — чтобы было к чему стремиться */
const SLIDES: HeroParts[][] = [
  [
    h({ pose: 'pose.stand', suit: 'suit.classic', suitColor: 'color.purple', accentColor: 'color.yellow', hair: 'hair.curly', skin: 'skin.4', emblem: 'emblem.bolt', hairColor: 'hairColor.black', cape: 'cape.short' }),
    h({ pose: 'pose.victory', suitColor: 'color.navy', accentColor: 'color.yellow', hair: 'hair.spiky', skin: 'skin.2', emblem: 'emblem.star', mask: 'mask.domino', hairColor: 'hairColor.blonde' }),
    h({ pose: 'pose.hips', suit: 'suit.armor', suitColor: 'color.green', accentColor: 'color.pink', hair: 'hair.buns', skin: 'skin.5', emblem: 'emblem.leaf', mask: 'mask.none', hairColor: 'hairColor.brown', cape: 'cape.split' }),
  ],
  [
    h({ pose: 'pose.hips', suit: 'suit.sport', suitColor: 'color.orange', accentColor: 'color.navy', hair: 'hair.ponytail', skin: 'skin.1', emblem: 'emblem.flame', mask: 'mask.bandana', hairColor: 'hairColor.red', cape: 'cape.none' }),
    h({ pose: 'pose.flex', suit: 'suit.lightning', suitColor: 'color.teal', accentColor: 'color.gold', hair: 'hair.short', skin: 'skin.6', emblem: 'emblem.crown', mask: 'mask.helmet', cape: 'cape.collar' }),
    h({ pose: 'pose.stand', suit: 'suit.classic', suitColor: 'color.pink', accentColor: 'color.purple', hair: 'hair.long', skin: 'skin.3', emblem: 'emblem.heart', mask: 'mask.domino', hairColor: 'hairColor.black', cape: 'cape.classic' }),
  ],
  [
    h({ pose: 'pose.fist', suit: 'suit.armor', suitColor: 'color.silver', accentColor: 'color.red', hair: 'hair.spiky', skin: 'skin.4', emblem: 'emblem.rocket', mask: 'mask.visor', hairColor: 'hairColor.blue', cape: 'cape.short' }),
    h({ pose: 'pose.victory', suit: 'suit.starry', suitColor: 'color.obsidian', accentColor: 'color.lime', hair: 'hair.curly', skin: 'skin.2', emblem: 'emblem.atom', mask: 'mask.winged', cape: 'cape.stars' }),
    h({ pose: 'pose.hips', suit: 'suit.sport', suitColor: 'color.yellow', accentColor: 'color.teal', hair: 'hair.buns', skin: 'skin.5', emblem: 'emblem.sun', mask: 'mask.none', hairColor: 'hairColor.pink', cape: 'cape.split' }),
  ],
  [
    h({ pose: 'pose.stand', suit: 'suit.cosmic', suitColor: 'color.navy', accentColor: 'color.white', hair: 'hair.short', skin: 'skin.3', emblem: 'emblem.planet', mask: 'mask.visor', hairColor: 'hairColor.brown', cape: 'cape.classic' }),
    h({ pose: 'pose.fist', suit: 'suit.classic', suitColor: 'color.red', accentColor: 'color.navy', hair: 'hair.long', skin: 'skin.1', emblem: 'emblem.note', mask: 'mask.domino', hairColor: 'hairColor.blonde', cape: 'cape.stars' }),
    h({ pose: 'pose.flex', suit: 'suit.lightning', suitColor: 'color.green', accentColor: 'color.orange', hair: 'hair.ponytail', skin: 'skin.6', emblem: 'emblem.snowflake', mask: 'mask.half', hairColor: 'hairColor.black', cape: 'cape.none' }),
  ],
];

const INTERVAL_MS = 4000;

const EXIT_MS = 600;

function Slide({ index, phase }: { index: number; phase: 'still' | 'in' | 'out' }) {
  return (
    <div
      className={`absolute inset-0 flex items-end justify-center gap-[3%] ${
        phase === 'in' ? 'anim-slide-in' : phase === 'out' ? 'anim-slide-out' : ''
      }`}
    >
      {SLIDES[index].map((parts, i) => (
        <div
          key={i}
          className={`${i === 1 ? 'w-[38%]' : 'w-[29%]'} ${phase === 'in' ? 'anim-hero-rise' : ''}`}
          style={phase === 'in' ? { animationDelay: `${0.08 + i * 0.07}s` } : undefined}
        >
          <HeroAvatar parts={parts} className="aspect-[5/6]" />
        </div>
      ))}
    </div>
  );
}

function HeroSlider() {
  const [index, setIndex] = useState(0);
  // Уходящий слайд ещё EXIT_MS виден с анимацией выхода; первый слайд появляется без анимации
  const [leaving, setLeaving] = useState<number | null>(null);
  const [moved, setMoved] = useState(false);
  const [paused, setPaused] = useState(false);

  const go = (next: number) => {
    if (next === index) return;
    setLeaving(index);
    setIndex(next);
    setMoved(true);
  };

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => go((index + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [index, paused]);

  useEffect(() => {
    if (leaving === null) return;
    const t = window.setTimeout(() => setLeaving(null), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [leaving, index]);

  return (
    <div
      className="relative flex h-full flex-col items-center justify-center px-10 py-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="карусель"
      aria-label="Примеры героев"
    >
      <div className="relative aspect-[16/10] w-full max-w-[720px]">
        {/* «Сцена»: мягкий свет за героями и пол под ногами, чтобы тёмный контур читался на тёмном фоне */}
        <div
          aria-hidden
          className="absolute inset-x-[4%] bottom-[2%] top-[6%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(255_194_51/0.16),transparent)]"
        />
        <div aria-hidden className="absolute inset-x-[10%] -bottom-[3%] h-[10%] rounded-[50%] bg-white/10 blur-md" />
        {leaving !== null && leaving !== index && <Slide key={`out-${leaving}`} index={leaving} phase="out" />}
        <Slide key={index} index={index} phase={moved ? 'in' : 'still'} />
      </div>

      <div className="mt-10 flex gap-2" role="tablist" aria-label="Слайды">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === index}
            aria-label={`Слайд ${i + 1}`}
            onClick={() => go(i)}
            className="flex h-6 min-w-6 items-center justify-center"
          >
            <span
              className={`block h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-8 bg-accent' : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.login.trim(), form.password);
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex items-center px-4 py-10 sm:px-10">
        <form onSubmit={submit} className="mx-auto w-full max-w-sm" noValidate>
          <h1 className="text-3xl leading-[1.1] sm:text-4xl">Вход в класс</h1>
          <p className="mt-3 text-ink-soft">Логин и пароль выдаёт преподаватель.</p>
          <div className="mt-8 space-y-5">
            <div>
              <label className="label" htmlFor="login">
                Логин
              </label>
              <input
                id="login"
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Пароль
              </label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              {error && (
                <p role="alert" className="mt-2 text-sm font-medium text-minus">
                  {error}
                </p>
              )}
            </div>
            <button className="btn btn-primary btn-lg w-full" disabled={busy || !form.login || !form.password}>
              {busy ? 'Входим…' : 'Войти'}
            </button>
          </div>
        </form>
      </div>

      {/* Панель всегда тёмная, независимо от темы, чтобы герои читались одинаково */}
      <div className="relative hidden overflow-hidden bg-[#161a33] lg:block dark:bg-[#1c2140]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(#ffc233 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }}
        />
        <HeroSlider />
      </div>
    </main>
  );
}
