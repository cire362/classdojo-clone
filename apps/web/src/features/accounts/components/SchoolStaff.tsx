import { useState, type FormEvent } from 'react';
import { KeyIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { SchoolRole, StaffMember, TeacherCredentials } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { createStaff, fetchStaff, removeStaff, resetStaffPassword, setStaffRole } from '../api';
import { ROLE_HINTS, ROLE_NAMES } from '../roles';
import { AccountFields } from './AccountFields';
import { IssuedCredentials } from './IssuedCredentials';

const ROLES: SchoolRole[] = ['DIRECTOR', 'DEPUTY', 'STAFF'];
const EMPTY = { name: '', login: '', role: 'DEPUTY' as SchoolRole };

/** Администрация школы. Видят все её сотрудники, меняет только директор, и только других: себя изменить нельзя */
export function SchoolStaff({ isDirector }: { isDirector: boolean }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => fetchStaff(), []);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [issued, setIssued] = useState<TeacherCredentials | null>(null);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T>(action: () => Promise<T>, done: (result: T) => void) {
    setBusy(true);
    try {
      done(await action());
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      setIssued(await createStaff(form));
      setCreating(false);
      setForm(EMPTY);
      void reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="staff-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="staff-title" className="text-lg">Администрация {data && <span className="text-ink-soft">({data.length})</span>}</h2>
        {isDirector && (
          <button className="btn btn-primary" onClick={() => { setFormError(''); setCreating(true); }}>
            <PlusIcon size={18} weight="bold" /> Добавить сотрудника
          </button>
        )}
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        {ROLES.map((role) => (
          <div key={role} className="rounded-xl bg-surface-2 p-3">
            <dt className="font-semibold">{ROLE_NAMES[role]}</dt>
            <dd className="text-ink-soft">{ROLE_HINTS[role]}</dd>
          </div>
        ))}
      </dl>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-40" />}
      {data && (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-52">
                <h3 className="break-words font-sans text-base font-semibold tracking-normal">
                  {m.name} {m.isMe && <span className="font-normal text-ink-soft">(вы)</span>}
                </h3>
                <p className="break-all font-mono text-sm text-ink-soft">{m.login}</p>
                {(!isDirector || m.isMe) && <p className="mt-1 text-sm">{ROLE_NAMES[m.role]}</p>}
              </div>
              {isDirector && !m.isMe && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${m.id}`}>Должность: {m.name}</label>
                  <select
                    id={`role-${m.id}`}
                    className="input w-auto py-2"
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => run(() => setStaffRole(m.id, e.target.value as SchoolRole), (list) => {
                      setData(list);
                      toast({ text: 'Должность изменена', tone: 'ok' });
                    })}
                  >
                    {ROLES.map((role) => <option key={role} value={role}>{ROLE_NAMES[role]}</option>)}
                  </select>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    aria-label={`Новый пароль: ${m.name}`}
                    onClick={() => run(() => resetStaffPassword(m.id), setIssued)}
                  >
                    <KeyIcon size={18} aria-hidden /> Новый пароль
                  </button>
                  <button
                    className="icon-btn"
                    disabled={busy}
                    aria-label={`Удалить: ${m.name}`}
                    title="Удалить"
                    onClick={() => setRemoving(m)}
                  >
                    <TrashIcon size={20} aria-hidden />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={creating} title="Новый сотрудник" onClose={() => { if (!busy) setCreating(false); }}>
        <form className="space-y-4" onSubmit={create}>
          <AccountFields idPrefix="staff" nameLabel="Имя сотрудника" value={form} onChange={setForm} />
          <div>
            <label className="label" htmlFor="staff-role">Должность</label>
            <select
              id="staff-role"
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as SchoolRole })}
            >
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_NAMES[role]}</option>)}
            </select>
            <p className="mt-2 text-sm text-ink-soft">{ROLE_HINTS[form.role]}</p>
          </div>
          {formError && <p role="alert" className="text-sm text-minus">{formError}</p>}
          <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.login.trim()}>
            {busy ? 'Создаём…' : 'Создать вход'}
          </button>
        </form>
      </Modal>
      <Modal open={!!removing} title="Удалить сотрудника?" onClose={() => { if (!busy) setRemoving(null); }}>
        <div className="space-y-4">
          <p><b>{removing?.name}</b> больше не сможет войти: вход удалится, на всех устройствах будет выполнен выход.</p>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => removing && run(() => removeStaff(removing.id), (list) => {
              setData(list);
              setRemoving(null);
              toast({ text: 'Сотрудник удалён', tone: 'ok' });
            })}
          >
            Удалить вход
          </button>
        </div>
      </Modal>
      <IssuedCredentials issued={issued} title="Передайте данные сотруднику" onClose={() => setIssued(null)} />
    </section>
  );
}
