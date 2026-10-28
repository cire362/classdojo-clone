import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { DEFAULT_HERO, type HeroParts } from '@heroes/shared';
import { useAuth } from '../auth';
import { HeroAvatar } from '../components/HeroAvatar';
import { Logo } from '../components/Layout';

const LINEUP: HeroParts[] = [
  { ...DEFAULT_HERO, pose: 'pose.stand', suit: 'suit.classic', suitColor: 'color.purple', accentColor: 'color.yellow', hair: 'hair.curly', skin: 'skin.4', emblem: 'emblem.bolt', hairColor: 'hairColor.black', cape: 'cape.short' },
  { ...DEFAULT_HERO, pose: 'pose.victory', suitColor: 'color.navy', accentColor: 'color.yellow', hair: 'hair.spiky', skin: 'skin.2', emblem: 'emblem.star', mask: 'mask.domino', hairColor: 'hairColor.blonde' },
  { ...DEFAULT_HERO, pose: 'pose.hips', suit: 'suit.armor', suitColor: 'color.green', accentColor: 'color.pink', hair: 'hair.buns', skin: 'skin.5', emblem: 'emblem.leaf', mask: 'mask.none', hairColor: 'hairColor.brown', cape: 'cape.split' },
];

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
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:py-10">
        <Logo />
        <div className="flex flex-1 items-center">
          <form onSubmit={submit} className="mx-auto w-full max-w-sm py-10" noValidate>
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
      </div>

      <div className="relative hidden overflow-hidden bg-ink lg:block" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(var(--accent) 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }}
        />
        <div className="relative flex h-full flex-col justify-end px-12 pb-12">
          <div className="flex items-end justify-center gap-2">
            {LINEUP.map((h, i) => (
              <motion.div
                key={i}
                className={i === 1 ? 'w-[40%]' : 'w-[30%]'}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.1 + i * 0.08 }}
              >
                <HeroAvatar parts={h} className="aspect-[5/6]" />
              </motion.div>
            ))}
          </div>
          <p className="mt-10 max-w-md font-display text-2xl leading-snug text-[#eef0fa]">
            Собирай баллы на уроках и открывай новые детали для своего героя.
          </p>
        </div>
      </div>
    </div>
  );
}
