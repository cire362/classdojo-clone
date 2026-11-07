import { useState } from 'react';
import { DownloadSimpleIcon, UsersThreeIcon } from '@phosphor-icons/react';
import type { AdminGroup } from '../../../lib/api';
import { exportUrl, longDate } from '../../../lib/files';
import { pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchAdminGroups } from '../api';
import { cap } from '@heroes/shared/terms';
import { useTerms } from '../../auth';

const searchText = (g: AdminGroup) =>
  [g.name, g.owner.name, g.owner.login, ...g.colleagues.map((t) => t.name)].join(' ').toLocaleLowerCase('ru');

/** Группы учреждения. Файлы группы скачивают руководитель и заместитель */
export function SchoolGroups({ canExport }: { canExport: boolean }) {
  const { data, error, reload } = useLoad(() => fetchAdminGroups(), []);
  const t = useTerms();
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase('ru');
  const visible = data?.filter((g) => searchText(g).includes(search)) ?? [];
  return (
    <section className="space-y-4" aria-labelledby="school-groups-title">
      <h2 id="school-groups-title" className="text-lg">
        {cap(t.group.many.nom)} {t.org.one.gen} {data && <span className="text-ink-soft">({data.length})</span>}
      </h2>
      <label className="block max-w-md">
        <span className="label">Поиск группы или преподавателя</span>
        <input type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => (
            <li key={g.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="break-words text-lg">{g.name}</h3>
                {g.archivedAt && <span className="chip bg-surface-2 text-ink-soft">В архиве</span>}
              </div>
              <p className="break-words text-sm">
                <b>{g.owner.name}</b>
                <span className="block break-all font-mono text-ink-soft">{g.owner.login}</span>
              </p>
              {g.colleagues.length > 0 && (
                <p className="break-words text-sm text-ink-soft">Соавторы: {g.colleagues.map((t) => t.name).join(', ')}</p>
              )}
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <UsersThreeIcon size={18} aria-hidden />
                {g.studentsCount} {pluralize(g.studentsCount, t.student.one.nom, t.student.one.gen, t.student.many.gen)}
              </p>
              {g.filesExpireAt && <p className="text-sm">Фото и файлы удалятся {longDate(g.filesExpireAt)}</p>}
              {canExport && (
                <a
                  className="btn btn-secondary btn-sm"
                  href={exportUrl(`/admin/groups/${g.id}`)}
                  download
                  aria-label={`Скачать файлы группы ${g.name}`}
                >
                  <DownloadSimpleIcon size={18} aria-hidden /> Скачать файлы
                </a>
              )}
            </li>
          ))}
          {!visible.length && (
            <li className="text-ink-soft">
              {search ? 'Ничего не найдено.' : `${cap(t.group.many.gen)} пока нет. Их создают преподаватели в своём кабинете.`}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
