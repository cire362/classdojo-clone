import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowRightIcon, PlusIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { HeroHead } from '../../hero';
import { ErrorBox, Skeleton } from '../../../ui';
import { pluralize, useLoad } from '../../../lib/hooks';
import { createGroup, fetchGroups, restoreGroup } from '../api';

export function GroupsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => fetchGroups(), []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const active = data?.filter((g) => !g.archivedAt) ?? [];
  const archived = data?.filter((g) => g.archivedAt) ?? [];

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setCreateError(null);
    try {
      const g = await createGroup(name);
      navigate(`/g/${g.id}/students`);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Здравствуйте, {user?.name}</h1>
        <p className="mt-2 text-ink-soft">Выберите группу, чтобы начать урок.</p>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2">
          {loading && !data && [0, 1].map((i) => <Skeleton key={i} className="h-36" />)}
          {active.map((g) => (
            <Link
              key={g.id}
              to={`/g/${g.id}`}
              className="card group flex min-h-36 flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] active:translate-y-0"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-display text-xl leading-tight">{g.name}</span>
                  {g.colleagues.length > 0 && (
                    <span className="mt-1 block truncate text-sm text-ink-soft">Вместе с: {g.colleagues.join(', ')}</span>
                  )}
                </span>
                {g.previewHeroes.length > 0 && (
                  <span className="flex -space-x-3" aria-hidden>
                    {g.previewHeroes.slice(0, 5).map((h, i) => (
                      <HeroHead key={i} parts={h} className="size-10 ring-2 ring-surface" />
                    ))}
                  </span>
                )}
              </span>
              <span className="mt-4 flex items-center justify-between text-ink-soft">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <UsersThreeIcon size={18} />
                  {g.studentsCount} {pluralize(g.studentsCount, 'ученик', 'ученика', 'учеников')}
                </span>
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-on-accent transition group-hover:translate-x-0.5">
                  <ArrowRightIcon size={20} weight="bold" />
                </span>
              </span>
            </Link>
          ))}
          {data && active.length === 0 && (
            <p className="text-ink-soft sm:col-span-2">
              {archived.length ? 'Действующих групп нет.' : 'Групп пока нет.'} Создайте группу, затем добавьте учеников.
            </p>
          )}
        </div>

        <form onSubmit={create} className="rounded-2xl border border-dashed border-line p-5" noValidate>
          <h2 className="flex items-center gap-2 text-lg">
            <PlusIcon size={20} weight="bold" /> Новая группа
          </h2>
          <label className="label mt-4" htmlFor="group-name">
            Название
          </label>
          <input
            id="group-name"
            className="input"
            placeholder="Например, 5 «Б»"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          {createError && <p className="mt-2 text-sm font-medium text-minus">{createError}</p>}
          <button className="btn btn-primary mt-4 w-full" disabled={busy || !name.trim()}>
            Создать
          </button>
        </form>
      </div>

      {archived.length > 0 && (
        <section className="space-y-3">
          <button className="btn btn-ghost -ml-3" onClick={() => setShowArchive((v) => !v)} aria-expanded={showArchive}>
            <ArchiveIcon size={20} /> Архив ({archived.length})
          </button>
          {showArchive && (
            <ul className="card divide-y divide-line overflow-hidden">
              {archived.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Link to={`/g/${g.id}/stats`} className="min-w-0 flex-1">
                    <span className="block font-display">{g.name}</span>
                    <span className="block text-sm text-ink-soft">
                      {g.studentsCount} {pluralize(g.studentsCount, 'ученик', 'ученика', 'учеников')}, в архиве с{' '}
                      {new Date(g.archivedAt!).toLocaleDateString('ru-RU')}
                    </span>
                  </Link>
                  {g.isOwner && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        await restoreGroup(g.id);
                        await reload();
                      }}
                    >
                      <ArrowCounterClockwiseIcon size={18} /> Вернуть
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
