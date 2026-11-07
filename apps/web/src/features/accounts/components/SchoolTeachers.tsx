import { useState, type FormEvent } from 'react';
import { KeyIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import type { AdminTeacher, TeacherCredentials } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { createTeacher, fetchTeachers, resetTeacherPassword, setTeacherPremium } from '../api';
import { IssuedCredentials } from './IssuedCredentials';
import { AccountFields } from './AccountFields';

/** Преподаватели школы. Добавлять, выдавать пароль и премиум могут директор и завуч, сотрудник только смотрит */
export function SchoolTeachers({ canManage }: { canManage: boolean }) {
  const { data, error, reload } = useLoad(() => fetchTeachers(), []);
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [reset, setReset] = useState<AdminTeacher | null>(null);
  const [plan, setPlan] = useState<AdminTeacher | null>(null);
  const [issued, setIssued] = useState<TeacherCredentials | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', login: '' });
  const [formError, setFormError] = useState('');
  const [until, setUntil] = useState('');

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const credentials = await createTeacher(form);
      setCreating(false);
      setForm({ name: '', login: '' });
      setIssued(credentials);
      void reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!reset) return;
    setBusy(true);
    try {
      setIssued(await resetTeacherPassword(reset.id));
      setReset(null);
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function openPlan(t: AdminTeacher) {
    setPlan(t);
    setUntil(t.premiumUntil ? new Date(t.premiumUntil).toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }) : '');
  }

  async function savePlan(date: string | null) {
    if (!plan) return;
    setBusy(true);
    try {
      await setTeacherPremium(plan.id, date);
      setPlan(null);
      void reload();
      toast({ text: 'Срок премиума сохранён', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const search = query.trim().toLocaleLowerCase('ru');
  const visible = data?.teachers.filter((t) => `${t.name} ${t.login}`.toLocaleLowerCase('ru').includes(search)) ?? [];
  const empty = search
    ? 'Преподаватели не найдены. Попробуйте другое имя или логин.'
    : canManage
      ? 'Добавьте первого преподавателя или включите код подключения.'
      : 'Преподавателей пока нет.';
  return (
    <section className="space-y-4" aria-labelledby="teachers-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="teachers-title" className="text-lg">
          Преподаватели {data && <span className="text-ink-soft">({data.teachers.length})</span>}
        </h2>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setFormError(''); setCreating(true); }}>
            <PlusIcon size={18} weight="bold" /> Добавить преподавателя
          </button>
        )}
      </div>
      <label className="relative block max-w-md">
        <span className="sr-only">Поиск преподавателя</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-3.5 text-ink-soft" size={20} aria-hidden />
        <input type="search" className="input pl-11" placeholder="Имя или логин" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {data?.freeForAll && (
        <p className="text-sm text-ink-soft">Премиум сейчас бесплатен для всех. Индивидуальные сроки можно настроить заранее.</p>
      )}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (
        <ul className="card divide-y divide-line overflow-hidden">
          {visible.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-52">
                <h3 className="break-words font-sans text-base font-semibold tracking-normal">{t.name}</h3>
                <p className="break-all font-mono text-sm text-ink-soft">{t.login}</p>
                <p className="mt-1 text-sm text-ink-soft">Свои группы: {t.ownedGroups} · Соавтор: {t.sharedGroups}</p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => openPlan(t)} aria-label={`Премиум: ${t.name}`}>
                    {data.freeForAll ? 'Премиум бесплатно' : t.premiumActive ? 'Премиум подключён' : 'Подключить премиум'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setReset(t)} aria-label={`Новый пароль: ${t.name}`}>
                    <KeyIcon size={18} /> Новый пароль
                  </button>
                </div>
              )}
            </li>
          ))}
          {visible.length === 0 && <li className="p-5 text-ink-soft">{empty}</li>}
        </ul>
      )}
      <Modal open={creating} title="Новый преподаватель" onClose={() => { if (!busy) setCreating(false); }}>
        <form className="space-y-4" onSubmit={create}>
          <AccountFields idPrefix="teacher" nameLabel="Имя преподавателя" value={form} onChange={setForm} />
          {formError && <p role="alert" className="text-sm text-minus">{formError}</p>}
          <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.login.trim()}>
            {busy ? 'Создаём…' : 'Создать вход'}
          </button>
        </form>
      </Modal>
      <Modal open={!!reset} title="Выдать новый пароль?" onClose={() => { if (!busy) setReset(null); }}>
        <div className="space-y-4">
          <p>
            <b>{reset?.name}</b> сможет войти с новым паролем. Старый пароль перестанет работать, на всех устройствах потребуется
            войти заново.
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={resetPassword}>{busy ? 'Меняем…' : 'Выдать новый пароль'}</button>
        </div>
      </Modal>
      <IssuedCredentials issued={issued} title="Передайте данные преподавателю" onClose={() => setIssued(null)} />
      <Modal open={!!plan} title="Срок премиума" onClose={() => { if (!busy) setPlan(null); }}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void savePlan(until); }}>
          <p className="font-semibold">{plan?.name}</p>
          {data?.freeForAll && (
            <p className="text-sm text-ink-soft">
              Сейчас все возможности бесплатны. Этот срок будет учитываться, когда общий бесплатный доступ закончится.
            </p>
          )}
          <div>
            <label className="label" htmlFor="premium-until">Действует до</label>
            <input id="premium-until" className="input" type="date" required value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || !until}>Сохранить срок</button>
            {plan?.premiumUntil && (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => savePlan(null)}>Убрать срок</button>
            )}
          </div>
        </form>
      </Modal>
    </section>
  );
}
