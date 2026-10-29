import { useState, type FormEvent } from 'react';
import { EyeIcon, EyeSlashIcon, KeyIcon, SparkleIcon, UserIcon } from '@phosphor-icons/react';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { useToast } from '../../components/Toast';
import { Skeleton } from '../../components/ui';
import { useLoad } from '../../hooks';

const MIN_LENGTH = 8;

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  show,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  show: boolean;
}) {
  return (
    <input
      id={id}
      className="input"
      type={show ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [pwd, setPwd] = useState({ current: '', next: '', repeat: '' });
  const [show, setShow] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      await api('PATCH', '/teacher/me', { name });
      await refresh();
      toast({ text: 'Имя сохранено', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setSavingName(false);
    }
  }

  const tooShort = pwd.next.length > 0 && pwd.next.length < MIN_LENGTH;
  const mismatch = pwd.repeat.length > 0 && pwd.repeat !== pwd.next;
  const canSave = pwd.current && pwd.next.length >= MIN_LENGTH && pwd.next === pwd.repeat;

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSavingPwd(true);
    setPwdError(null);
    try {
      await api('POST', '/teacher/me/password', { currentPassword: pwd.current, newPassword: pwd.next });
      setPwd({ current: '', next: '', repeat: '' });
      setShow(false);
      toast({ text: 'Пароль изменён. На других устройствах выполнен выход', tone: 'ok' });
    } catch (err) {
      setPwdError((err as Error).message);
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Настройки</h1>
        <p className="mt-2 text-ink-soft">Логин: <span className="font-mono">{user?.login}</span></p>
      </div>

      <form onSubmit={saveName} className="card space-y-4 p-5" noValidate>
        <h2 className="flex items-center gap-2 text-lg">
          <UserIcon size={22} /> Имя
        </h2>
        <div>
          <label className="label" htmlFor="teacher-name">
            Как к вам обращаться
          </label>
          <input id="teacher-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <p className="mt-2 text-sm text-ink-soft">Имя видно в шапке и в приветствии.</p>
        </div>
        <button className="btn btn-primary" disabled={savingName || !name.trim() || name.trim() === user?.name}>
          {savingName ? 'Сохраняем…' : 'Сохранить имя'}
        </button>
      </form>

      <form onSubmit={savePassword} className="card space-y-4 p-5" noValidate>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg">
            <KeyIcon size={22} /> Пароль
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow((v) => !v)} aria-pressed={show}>
            {show ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
            {show ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        <div>
          <label className="label" htmlFor="pwd-current">
            Текущий пароль
          </label>
          <PasswordInput id="pwd-current" value={pwd.current} onChange={(v) => setPwd({ ...pwd, current: v })} autoComplete="current-password" show={show} />
        </div>
        <div>
          <label className="label" htmlFor="pwd-next">
            Новый пароль
          </label>
          <PasswordInput id="pwd-next" value={pwd.next} onChange={(v) => setPwd({ ...pwd, next: v })} autoComplete="new-password" show={show} />
          <p className={`mt-2 text-sm ${tooShort ? 'font-medium text-minus' : 'text-ink-soft'}`}>Не короче {MIN_LENGTH} символов.</p>
        </div>
        <div>
          <label className="label" htmlFor="pwd-repeat">
            Новый пароль ещё раз
          </label>
          <PasswordInput id="pwd-repeat" value={pwd.repeat} onChange={(v) => setPwd({ ...pwd, repeat: v })} autoComplete="new-password" show={show} />
          {mismatch && <p className="mt-2 text-sm font-medium text-minus">Пароли не совпадают</p>}
        </div>
        {pwdError && (
          <p role="alert" className="text-sm font-medium text-minus">
            {pwdError}
          </p>
        )}
        <p className="text-sm text-ink-soft">После смены пароля вы останетесь в системе здесь, а на других устройствах нужно будет войти заново.</p>
        <button className="btn btn-primary" disabled={savingPwd || !canSave}>
          {savingPwd ? 'Сохраняем…' : 'Сменить пароль'}
        </button>
      </form>

      <PremiumCard />
    </div>
  );
}

/** Премиум: пока без оплаты на сайте — подключает администратор */
function PremiumCard() {
  const { data } = useLoad(() => api<{ active: boolean; until: string | null; freeForAll: boolean }>('GET', '/teacher/plan'), []);
  return (
    <section className="card space-y-4 p-5" aria-labelledby="premium-title">
      <h2 id="premium-title" className="flex items-center gap-2 text-lg">
        <SparkleIcon size={22} weight="fill" /> Премиум
      </h2>
      {!data ? (
        <Skeleton className="h-16" />
      ) : data.freeForAll ? (
        <p>Сейчас премиум бесплатен для всех: ученикам ваших групп открыта премиум-коллекция «Космос».</p>
      ) : data.active ? (
        <p>
          Подключён до <b>{new Date(data.until!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</b>. Ученикам ваших
          групп открыта премиум-коллекция «Космос».
        </p>
      ) : (
        <p>
          {data.until ? 'Срок премиума закончился.' : 'Сейчас у вас бесплатный тариф: все функции для уроков работают без ограничений.'}
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li>Премиум-коллекция деталей героя «Космос»: галактика, плащ-комета, костюм астронавта, алмаз и особые цвета.</li>
        <li>Действует для учеников групп, которые вы создали; детали открываются по уровню, как обычные.</li>
      </ul>
      {data && !data.active && <p className="text-sm text-ink-soft">Оплата на сайте появится позже. Чтобы подключить премиум сейчас, обратитесь к администратору.</p>}
    </section>
  );
}
