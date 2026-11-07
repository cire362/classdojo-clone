import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { SchoolJoinPreview } from '../../../lib/api';
import { joinSchool, previewSchoolJoin } from '../api';
import { AccountFields } from './AccountFields';
import { termsFor } from '@heroes/shared/terms';

const MIN_PASSWORD = 8;

/**
 * Преподаватель подключается к школе: код из ссылки или от администрации, затем имя, логин и пароль.
 * Вход откроется после проверки директором или завучем
 */
export function TeacherJoin() {
  const fromLink = useRef(window.location.hash.slice(1));
  const started = useRef(false);
  const [code, setCode] = useState(fromLink.current);
  const [school, setSchool] = useState<SchoolJoinPreview | null>(null);
  const [form, setForm] = useState({ name: '', login: '', password: '', repeat: '' });
  const [sent, setSent] = useState(false);
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
  const check = (value: string) => attempt(async () => setSchool(await previewSchoolJoin(value)));

  useEffect(() => {
    if (started.current || !fromLink.current) return;
    started.current = true;
    // Код убирается из адреса, чтобы не остаться в истории браузера
    window.history.replaceState(window.history.state, '', window.location.pathname);
    void check(fromLink.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    void attempt(async () => {
      await joinSchool({ code, name: form.name.trim(), login: form.login.trim(), password: form.password });
      setSent(true);
    });
  }

  const alert = error && <p role="alert" className="text-sm font-medium text-minus">{error}</p>;
  const tooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD;
  const mismatch = form.repeat.length > 0 && form.repeat !== form.password;
  const ready = form.name.trim() && form.login.trim() && form.password.length >= MIN_PASSWORD && form.password === form.repeat;

  if (sent && school) {
    return (
      <main className="mx-auto max-w-sm space-y-5 px-4 py-16">
        <h1 className="text-3xl">Заявка отправлена</h1>
        <p>
          Администрация {termsFor(school.kind).org.one.gen} «{school.schoolName}» проверит заявку.
          После подтверждения войдите с логином{' '}
          <b className="break-all font-mono">{form.login.trim().toLowerCase()}</b> и своим паролем.
        </p>
        <Link to="/login" className="btn btn-primary btn-lg w-full">Ко входу</Link>
      </main>
    );
  }

  if (!school) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <form onSubmit={(e) => { e.preventDefault(); void check(code); }} className="space-y-5" noValidate>
          <h1 className="text-3xl">Подключение к учебному заведению</h1>
          <p className="text-ink-soft">Для преподавателей. Код подключения выдаёт администрация.</p>
          <div className="space-y-2">
            <label className="label" htmlFor="school-code">Код подключения</label>
            <input
              id="school-code"
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
          <Link to="/login" className="btn btn-ghost w-full">У меня уже есть вход</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <h1 className="break-words text-3xl">{school.schoolName}</h1>
          <p className="mt-2 text-ink-soft">Создайте вход преподавателя. Войти можно будет после проверки администрацией.</p>
        </div>
        <AccountFields
          idPrefix="join"
          nameLabel={`Как вас называть ${termsFor(school.kind).student.many.dat}`}
          loginHint="От 3 символов: латинские буквы, цифры, точка или дефис."
          value={form}
          onChange={setForm}
        />
        <div>
          <label className="label" htmlFor="join-password">Пароль</label>
          <input
            id="join-password"
            className="input"
            type="password"
            autoComplete="new-password"
            aria-describedby="join-password-hint"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p id="join-password-hint" className={`mt-1 text-sm ${tooShort ? 'text-minus' : 'text-ink-soft'}`}>
            Не короче {MIN_PASSWORD} символов.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="join-repeat">Пароль ещё раз</label>
          <input
            id="join-repeat"
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.repeat}
            onChange={(e) => setForm({ ...form, repeat: e.target.value })}
          />
          {mismatch && <p className="mt-1 text-sm text-minus">Пароли не совпадают.</p>}
        </div>
        {alert}
        <button className="btn btn-primary btn-lg w-full" disabled={busy || !ready}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button>
        <button type="button" className="btn btn-ghost w-full" onClick={() => { setSchool(null); setError(''); }}>Другой код</button>
      </form>
    </main>
  );
}
