import { useState, type FormEvent } from 'react';
import { EyeIcon, EyeSlashIcon, KeyIcon } from '@phosphor-icons/react';
import { api } from '../api';
import { useToast } from './Toast';

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

/** Смена своего пароля. endpoint — адрес для роли: преподавателя или администратора */
export function PasswordCard({ endpoint }: { endpoint: string }) {
  const toast = useToast();
  const [pwd, setPwd] = useState({ current: '', next: '', repeat: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tooShort = pwd.next.length > 0 && pwd.next.length < MIN_LENGTH;
  const mismatch = pwd.repeat.length > 0 && pwd.repeat !== pwd.next;
  const canSave = pwd.current && pwd.next.length >= MIN_LENGTH && pwd.next === pwd.repeat;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await api('POST', endpoint, { currentPassword: pwd.current, newPassword: pwd.next });
      setPwd({ current: '', next: '', repeat: '' });
      setShow(false);
      toast({ text: 'Пароль изменён. На других устройствах выполнен выход', tone: 'ok' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5" noValidate>
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
      {error && (
        <p role="alert" className="text-sm font-medium text-minus">
          {error}
        </p>
      )}
      <p className="text-sm text-ink-soft">После смены пароля вы останетесь в системе здесь, а на других устройствах нужно будет войти заново.</p>
      <button className="btn btn-primary" disabled={saving || !canSave}>
        {saving ? 'Сохраняем…' : 'Сменить пароль'}
      </button>
    </form>
  );
}
