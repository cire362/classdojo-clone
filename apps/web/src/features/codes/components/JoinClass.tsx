import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { HeroHead } from '../../hero';
import type { ClassRoster } from '../../../lib/api';
import { fetchRoster, loginByClassCode } from '../api';

/** Вход по общему коду: ввести код или открыть его по QR, затем выбрать своё имя */
export function JoinClass() {
  const { signedIn } = useAuth();
  const navigate = useNavigate();
  const fromLink = useRef(window.location.hash.slice(1));
  const started = useRef(false);
  const [code, setCode] = useState(fromLink.current);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function check(value: string) {
    setBusy(true);
    setError('');
    try {
      setRoster(await fetchRoster(value));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (started.current || !fromLink.current) return;
    started.current = true;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    void check(fromLink.current);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    void check(code);
  }
  async function choose(studentId: string) {
    setBusy(true);
    setError('');
    try {
      const { user } = await loginByClassCode(code, studentId);
      signedIn(user);
      navigate('/', { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:py-16">
      {roster ? (
        <>
          <div>
            <h1 className="text-3xl">Кто ты?</h1>
            <p className="mt-2 text-ink-soft">{roster.groupName}. Выбери своё имя.</p>
          </div>
          {error && <p role="alert" className="font-medium text-minus">{error}</p>}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {roster.students.map((s) => (
              <li key={s.id}>
                <button
                  className="card flex w-full items-center gap-3 p-3 text-left transition hover:shadow-[var(--shadow-pop)]"
                  disabled={busy}
                  onClick={() => choose(s.id)}
                >
                  <HeroHead parts={s.hero.parts} />
                  <span className="min-w-0 break-words font-semibold">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost btn-sm -ml-3" onClick={() => setRoster(null)}>Другой код</button>
        </>
      ) : (
        <form onSubmit={submit} className="mx-auto max-w-sm space-y-5" noValidate>
          <h1 className="text-3xl">Код класса</h1>
          <p className="text-ink-soft">Учитель покажет код на экране.</p>
          <div>
            <label className="label" htmlFor="class-code">Код</label>
            <input
              id="class-code"
              className="input font-mono uppercase tracking-[0.15em]"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <p role="alert" className="mt-2 text-sm font-medium text-minus">{error}</p>}
          </div>
          <button className="btn btn-primary btn-lg w-full" disabled={busy || !code.trim()}>{busy ? 'Проверяем…' : 'Дальше'}</button>
          <Link to="/login" className="btn btn-ghost w-full">Войти по логину</Link>
        </form>
      )}
    </main>
  );
}
