import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import type { InvitePreview } from '../../../lib/api';
import { acceptInvite, addChildByInvite, previewInvite } from '../api';

const MIN_LENGTH = 8;

/** Приглашение родителя: код из ссылки или с листа, затем свой пароль. Готовый вход можно дополнить ребёнком. */
export function AcceptInvite() {
  const { user, signedIn } = useAuth();
  const navigate = useNavigate();
  const fromLink = useRef(window.location.hash.slice(1));
  const started = useRef(false);
  const [code, setCode] = useState(fromLink.current);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [password, setPassword] = useState({ next: '', repeat: '' });
  const [login, setLogin] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function attempt(run: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const check = (value: string) => attempt(async () => setInvite(await previewInvite(value)));

  useEffect(() => {
    if (started.current || !fromLink.current) return;
    started.current = true;
    // Код убирается из адреса, чтобы не остаться в истории браузера
    window.history.replaceState(window.history.state, '', window.location.pathname);
    void check(fromLink.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitCode(e: FormEvent) {
    e.preventDefault();
    void check(code);
  }
  function submitPassword(e: FormEvent) {
    e.preventDefault();
    void attempt(async () => {
      const accepted = await acceptInvite(code, password.next);
      signedIn(accepted.user);
      setLogin(accepted.login);
    });
  }
  const addChild = () => attempt(async () => {
    await addChildByInvite(code);
    navigate('/', { replace: true });
  });

  const tooShort = password.next.length > 0 && password.next.length < MIN_LENGTH;
  const mismatch = password.repeat.length > 0 && password.repeat !== password.next;
  const canSave = password.next.length >= MIN_LENGTH && password.next === password.repeat;
  const alert = error && <p role="alert" className="text-sm font-medium text-minus">{error}</p>;

  if (login) {
    return (
      <main className="mx-auto max-w-sm space-y-5 px-4 py-16">
        <h1 className="text-3xl">Вход создан</h1>
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-sm text-ink-soft">Ваш логин</p>
          <p className="break-words font-mono text-xl font-semibold">{login}</p>
        </div>
        <p className="text-ink-soft">Запишите логин: он понадобится при следующем входе вместе с вашим паролем.</p>
        <button className="btn btn-primary btn-lg w-full" onClick={() => navigate('/', { replace: true })}>В кабинет</button>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <form onSubmit={submitCode} className="space-y-5" noValidate>
          <h1 className="text-3xl">Приглашение для родителей</h1>
          <p className="text-ink-soft">Введите код с листа, который выдал преподаватель.</p>
          <div className="space-y-2">
            <label className="label" htmlFor="invite-code">Код приглашения</label>
            <input
              id="invite-code"
              className="input font-mono uppercase tracking-[0.1em]"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={30}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {alert}
          </div>
          <button className="btn btn-primary btn-lg w-full" disabled={busy || !code.trim()}>{busy ? 'Проверяем…' : 'Дальше'}</button>
          <Link to="/login" className="btn btn-ghost w-full">Войти по логину</Link>
        </form>
      </main>
    );
  }

  if (user?.role === 'PARENT') {
    return (
      <main className="mx-auto max-w-sm space-y-5 px-4 py-16">
        <h1 className="text-3xl">{invite.studentName}</h1>
        <p className="text-ink-soft">{invite.groupName}. Добавить ребёнка к вашему входу?</p>
        {alert}
        <button className="btn btn-primary btn-lg w-full" disabled={busy} onClick={addChild}>Добавить ребёнка</button>
        <Link to="/" className="btn btn-ghost w-full">Не сейчас</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submitPassword} className="space-y-5" noValidate>
        <div>
          <h1 className="text-3xl">Вход для родителей</h1>
          <p className="mt-2 text-ink-soft">{invite.studentName}, {invite.groupName}. Придумайте пароль: логин мы создадим сами.</p>
        </div>
        <div>
          <label className="label" htmlFor="invite-password">Пароль</label>
          <input
            id="invite-password"
            className="input"
            type="password"
            autoComplete="new-password"
            aria-describedby="invite-password-hint"
            value={password.next}
            onChange={(e) => setPassword({ ...password, next: e.target.value })}
          />
          <p id="invite-password-hint" className={`mt-1 text-sm ${tooShort ? 'text-minus' : 'text-ink-soft'}`}>
            Не короче {MIN_LENGTH} символов.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="invite-repeat">Пароль ещё раз</label>
          <input
            id="invite-repeat"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password.repeat}
            onChange={(e) => setPassword({ ...password, repeat: e.target.value })}
          />
          {mismatch && <p className="mt-1 text-sm text-minus">Пароли не совпадают.</p>}
        </div>
        {alert}
        <button className="btn btn-primary btn-lg w-full" disabled={busy || !canSave}>{busy ? 'Создаём…' : 'Создать вход'}</button>
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => navigate('/login', { state: { from: `/invite#${code}` } })}
        >
          У меня уже есть вход
        </button>
      </form>
    </main>
  );
}
