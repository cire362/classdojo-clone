import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightIcon, PlusIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { api, type GroupListItem } from '../../api';
import { useAuth } from '../../auth';
import { HeroHead } from '../../components/HeroAvatar';
import { ErrorBox, Skeleton } from '../../components/ui';
import { pluralize, useLoad } from '../../hooks';

export function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => api<GroupListItem[]>('GET', '/teacher/groups'), []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setCreateError(null);
    try {
      const g = await api<GroupListItem>('POST', '/teacher/groups', { name });
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

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {loading && !data && [0, 1].map((i) => <Skeleton key={i} className="h-36" />)}
          {data?.map((g) => (
            <Link
              key={g.id}
              to={`/g/${g.id}`}
              className="card group flex min-h-36 flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] active:translate-y-0"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-display text-xl leading-tight">{g.name}</span>
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
          {data && data.length === 0 && (
            <p className="text-ink-soft sm:col-span-2">Групп пока нет. Создайте первую, затем добавьте учеников.</p>
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
    </div>
  );
}
