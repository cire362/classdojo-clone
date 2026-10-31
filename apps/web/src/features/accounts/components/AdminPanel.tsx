import { useState, type FormEvent } from 'react';
import { KeyIcon, PlusIcon, MagnifyingGlassIcon, UsersThreeIcon } from '@phosphor-icons/react';
import type { AdminTeacher, TeacherCredentials } from '../../../lib/api';
import { PasswordCard } from './PasswordCard';
import { useToast } from '../../../ui/Toast';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { pluralize, useLoad } from '../../../lib/hooks';
import { createTeacher, fetchAdminGroups, fetchTeachers, resetTeacherPassword, setTeacherPremium } from '../api';

/** Администратор школы: преподаватели, доступы и обзор всех групп. */
export function AdminPanel() {
  const [tab, setTab] = useState<'teachers' | 'groups' | 'password'>('teachers');
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-soft">Управление школой</p>
        <h1 className="text-2xl sm:text-3xl">Администратор</h1>
      </div>
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Разделы школы">
        <button className={`tab ${tab === 'teachers' ? 'active' : ''}`} aria-current={tab === 'teachers' ? 'page' : undefined} onClick={() => setTab('teachers')}>Преподаватели</button>
        <button className={`tab ${tab === 'groups' ? 'active' : ''}`} aria-current={tab === 'groups' ? 'page' : undefined} onClick={() => setTab('groups')}>Группы школы</button>
        <button className={`tab ${tab === 'password' ? 'active' : ''}`} aria-current={tab === 'password' ? 'page' : undefined} onClick={() => setTab('password')}>Мой пароль</button>
      </nav>
      {tab === 'teachers' && <Teachers />}
      {tab === 'groups' && <Groups />}
      {tab === 'password' && <div className="max-w-2xl"><PasswordCard endpoint="/admin/me/password" /></div>}
    </div>
  );
}

function Teachers() {
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
  return (
    <section className="space-y-4" aria-labelledby="teachers-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="teachers-title" className="text-lg">Преподаватели {data && <span className="text-ink-soft">({data.teachers.length})</span>}</h2>
        <button className="btn btn-primary" onClick={() => { setFormError(''); setCreating(true); }}>
          <PlusIcon size={18} weight="bold" /> Добавить преподавателя
        </button>
      </div>
      <label className="relative block max-w-md">
        <span className="sr-only">Поиск преподавателя</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-3.5 text-ink-soft" size={20} aria-hidden />
        <input type="search" className="input pl-11" placeholder="Имя или логин" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {data?.freeForAll && <p className="text-sm text-ink-soft">Премиум сейчас бесплатен для всех. Индивидуальные сроки можно настроить заранее.</p>}
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
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => { setPlan(t); setUntil(t.premiumUntil ? new Date(t.premiumUntil).toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }) : ''); }} aria-label={`Премиум: ${t.name}`}>
                  {data.freeForAll ? 'Премиум бесплатно' : t.premiumActive ? 'Премиум подключён' : 'Подключить премиум'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setReset(t)} aria-label={`Новый пароль: ${t.name}`}>
                  <KeyIcon size={18} /> Новый пароль
                </button>
              </div>
            </li>
          ))}
          {visible.length === 0 && <li className="p-5 text-ink-soft">{search ? 'Преподаватели не найдены. Попробуйте другое имя или логин.' : 'Добавьте первого преподавателя, чтобы он мог создать группу.'}</li>}
        </ul>
      )}
      <Modal open={creating} title="Новый преподаватель" onClose={() => { if (!busy) setCreating(false); }}>
        <form className="space-y-4" onSubmit={create}>
          <div>
            <label className="label" htmlFor="teacher-name">Имя преподавателя</label>
            <input id="teacher-name" className="input" autoComplete="name" maxLength={80} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="teacher-login">Логин</label>
            <input id="teacher-login" className="input font-mono" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" minLength={3} maxLength={64} pattern="[a-zA-Z0-9._\-]{3,64}" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} aria-describedby="teacher-login-hint" />
            <p id="teacher-login-hint" className="mt-2 text-sm text-ink-soft">От 3 символов: латинские буквы, цифры, точка или дефис. Пароль создадим автоматически.</p>
          </div>
          {formError && <p role="alert" className="text-sm text-minus">{formError}</p>}
          <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.login.trim()}>{busy ? 'Создаём…' : 'Создать вход'}</button>
        </form>
      </Modal>
      <Modal open={!!reset} title="Выдать новый пароль?" onClose={() => { if (!busy) setReset(null); }}>
        <div className="space-y-4">
          <p><b>{reset?.name}</b> сможет войти с новым паролем. Старый пароль перестанет работать, на всех устройствах потребуется войти заново.</p>
          <button className="btn btn-primary" disabled={busy} onClick={resetPassword}>{busy ? 'Меняем…' : 'Выдать новый пароль'}</button>
        </div>
      </Modal>
      <Modal open={!!issued} title="Передайте данные преподавателю" onClose={() => setIssued(null)}>
        {issued && <div className="space-y-4">
          <p className="font-semibold">{issued.name}</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl bg-surface-2 p-4">
            <dt>Логин</dt><dd className="break-all font-mono font-semibold">{issued.login}</dd>
            <dt>Пароль</dt><dd className="break-all font-mono font-semibold">{issued.password}</dd>
          </dl>
          <p className="text-sm text-ink-soft">Пароль показывается только сейчас. Сохраните его перед закрытием окна.</p>
          <button className="btn btn-primary" onClick={() => setIssued(null)}>Данные сохранены, закрыть</button>
        </div>}
      </Modal>
      <Modal open={!!plan} title="Срок премиума" onClose={() => { if (!busy) setPlan(null); }}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void savePlan(until); }}>
          <p className="font-semibold">{plan?.name}</p>
          {data?.freeForAll && <p className="text-sm text-ink-soft">Сейчас все возможности бесплатны. Этот срок будет учитываться, когда общий бесплатный доступ закончится.</p>}
          <div><label className="label" htmlFor="premium-until">Действует до</label><input id="premium-until" className="input" type="date" required value={until} onChange={(e) => setUntil(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || !until}>Сохранить срок</button>
            {plan?.premiumUntil && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => savePlan(null)}>Убрать срок</button>}
          </div>
        </form>
      </Modal>
    </section>
  );
}

function Groups() {
  const { data, error, reload } = useLoad(() => fetchAdminGroups(), []);
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase('ru');
  const visible = data?.filter((g) => [g.name, g.owner.name, g.owner.login, ...g.colleagues.map((t) => t.name)].join(' ').toLocaleLowerCase('ru').includes(search)) ?? [];
  return (
    <section className="space-y-4" aria-labelledby="school-groups-title">
      <h2 id="school-groups-title" className="text-lg">Группы школы {data && <span className="text-ink-soft">({data.length})</span>}</h2>
      <label className="block max-w-md"><span className="label">Поиск группы или преподавателя</span><input type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((g) => <li key={g.id} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words text-lg">{g.name}</h3>{g.archivedAt && <span className="chip bg-surface-2 text-ink-soft">В архиве</span>}</div>
          <p className="break-words text-sm"><b>{g.owner.name}</b><span className="block break-all font-mono text-ink-soft">{g.owner.login}</span></p>
          {g.colleagues.length > 0 && <p className="break-words text-sm text-ink-soft">Соавторы: {g.colleagues.map((t) => t.name).join(', ')}</p>}
          <p className="flex items-center gap-2 text-sm text-ink-soft"><UsersThreeIcon size={18} aria-hidden />{g.studentsCount} {pluralize(g.studentsCount, 'ученик', 'ученика', 'учеников')}</p>
        </li>)}
        {!visible.length && <li className="text-ink-soft">{search ? 'Группы не найдены.' : 'Групп пока нет. Их создают преподаватели в своём кабинете.'}</li>}
      </ul>}
    </section>
  );
}
