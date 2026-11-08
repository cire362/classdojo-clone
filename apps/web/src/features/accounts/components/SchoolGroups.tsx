import { useState } from 'react';
import { CalendarPlusIcon, DownloadSimpleIcon, PencilSimpleIcon, UsersThreeIcon } from '@phosphor-icons/react';
import type { AdminGroup } from '../../../lib/api';
import { exportUrl, longDate } from '../../../lib/files';
import { pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchAdminGroups } from '../api';
import { cap } from '@heroes/shared/terms';
import { useTerms } from '../../auth';
import { departmentOptions, fetchDepartments } from '../../departments';
import { NewYearModal } from '../../schoolyear';
import { GroupMetaModal } from './GroupMetaModal';

const searchText = (g: AdminGroup) =>
  [g.name, g.owner.name, g.owner.login, g.specialty, g.department?.name ?? '', ...g.colleagues.map((t) => t.name)]
    .join(' ')
    .toLocaleLowerCase('ru');

/**
 * Группы учреждения или подразделения смотрящего. Файлы группы скачивают и подразделение, курс и специальность
 * задают директор и заместитель (сотрудник подразделения — для своих групп)
 */
export function SchoolGroups({ canExport, departmentId, canStartYear = false }: {
  canExport: boolean;
  departmentId: string | null;
  /** Руководитель и заместитель всего учреждения переводят группы на новый учебный год */
  canStartYear?: boolean;
}) {
  const { data, error, reload, setData } = useLoad(() => fetchAdminGroups(), []);
  const t = useTerms();
  const departments = useLoad(() => (t.kind === 'SCHOOL' ? Promise.resolve([]) : fetchDepartments()), [t.kind]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<AdminGroup | null>(null);
  const [newYear, setNewYear] = useState(false);
  const search = query.trim().toLocaleLowerCase('ru');
  const courseWord = t.course.toLocaleLowerCase('ru');
  const all = departmentOptions(departments.data ?? []);
  // Сотрудник подразделения выбирает только его и вложенные подразделения
  const scope = departmentId
    ? new Set([departmentId, ...(departments.data ?? []).filter((d) => d.parentId === departmentId).map((d) => d.id)])
    : null;
  const options = scope ? all.filter((o) => scope.has(o.id)) : all;
  const visible = data?.filter((g) => searchText(g).includes(search) && (!filter || g.department?.id === filter)) ?? [];
  return (
    <section className="space-y-4" aria-labelledby="school-groups-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="school-groups-title" className="text-lg">
          {cap(t.group.many.nom)} {t.org.one.gen} {data && <span className="text-ink-soft">({data.length})</span>}
        </h2>
        {canStartYear && (
          <button className="btn btn-secondary" onClick={() => setNewYear(true)}>
            <CalendarPlusIcon size={20} /> Новый учебный год
          </button>
        )}
      </div>
      {newYear && (
        <NewYearModal
          onClose={() => setNewYear(false)}
          onDone={() => {
            setNewYear(false);
            void reload();
          }}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <label className="block min-w-0 max-w-md flex-1 basis-60">
          <span className="label">Поиск группы или преподавателя</span>
          <input type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {options.length > 0 && (
          <label className="block basis-60">
            <span className="label">Подразделение</span>
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Все</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}
      </div>
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
              {(g.department || g.course || g.specialty) && (
                <p className="break-words text-sm">
                  {[g.department?.name, g.course && `${courseWord} ${g.course}`, g.specialty].filter(Boolean).join(' · ')}
                </p>
              )}
              {g.colleagues.length > 0 && (
                <p className="break-words text-sm text-ink-soft">Соавторы: {g.colleagues.map((t) => t.name).join(', ')}</p>
              )}
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <UsersThreeIcon size={18} aria-hidden />
                {g.studentsCount} {pluralize(g.studentsCount, t.student.one.nom, t.student.one.gen, t.student.many.gen)}
              </p>
              {g.filesExpireAt && <p className="text-sm">Фото и файлы удалятся {longDate(g.filesExpireAt)}</p>}
              {canExport && (
                <button className="btn btn-ghost btn-sm" aria-label={`Подразделение и курс: ${g.name}`} onClick={() => setEditing(g)}>
                  <PencilSimpleIcon size={18} aria-hidden /> {t.kind === 'SCHOOL' ? t.course : 'Подразделение и курс'}
                </button>
              )}
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
      <GroupMetaModal group={editing} options={options} onClose={() => setEditing(null)} onSaved={setData} />
    </section>
  );
}
