import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheckIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import type { Stats } from '../../../lib/api';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { dateKey, formatDate, useLoad } from '../../../lib/hooks';
import { useGroup } from '../../groups';
import { WeeklyPoints } from './WeeklyPoints';
import { fetchStats } from '../api';
import { useTerms } from '../../auth';
import { cap } from '@heroes/shared/terms';

function presets() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const sept = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
  return [
    { label: 'Неделя', from: dateKey(monday), to: dateKey(now) },
    { label: 'Месяц', from: dateKey(monthStart), to: dateKey(now) },
    { label: 'Прошлый месяц', from: dateKey(prevStart), to: dateKey(prevEnd) },
    { label: 'Учебный год', from: dateKey(sept), to: dateKey(now) },
  ];
}

type SortKey = 'name' | 'earned' | 'net' | 'attendance';

export function StatsBoard() {
  const t = useTerms();
  const { data: group } = useGroup();
  const options = useMemo(presets, []);
  const [range, setRange] = useState({ from: options[1].from, to: options[1].to });
  const [sort, setSort] = useState<SortKey>('earned');
  const { data, error, loading, reload } = useLoad(
    () => fetchStats(group.group.id, range.from, range.to),
    [group.group.id, range.from, range.to],
  );

  const rows = useMemo(() => {
    const list = [...(data?.students ?? [])];
    const by: Record<SortKey, (a: Stats['students'][0], b: Stats['students'][0]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, 'ru'),
      earned: (a, b) => b.earned - a.earned,
      net: (a, b) => b.net - a.net,
      attendance: (a, b) => (b.attendanceRate ?? -1) - (a.attendanceRate ?? -1),
    };
    return list.sort(by[sort]);
  }, [data, sort]);

  const xlsxUrl = `/api/teacher/groups/${group.group.id}/stats.xlsx?from=${range.from}&to=${range.to}`;
  const th = (key: SortKey, label: string, cls = '') => (
    <th className={`px-3 py-3 font-semibold ${cls}`}>
      <button className={`inline-flex items-center gap-1 ${sort === key ? 'text-ink' : ''}`} onClick={() => setSort(key)} aria-pressed={sort === key}>
        {label}
        {sort === key && <span aria-hidden>↓</span>}
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Период">
          {options.map((o) => {
            const active = o.from === range.from && o.to === range.to;
            return (
              <button key={o.label} className={`tab ${active ? 'active' : 'bg-surface-2'}`} onClick={() => setRange({ from: o.from, to: o.to })}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="label text-xs" htmlFor="from">
              С
            </label>
            <input id="from" type="date" className="input py-2" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
          </div>
          <div>
            <label className="label text-xs" htmlFor="to">
              По
            </label>
            <input id="to" type="date" className="input py-2" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
          </div>
        </div>
        <a href={xlsxUrl} className="btn btn-primary ml-auto" download>
          <DownloadSimpleIcon size={20} weight="bold" /> Скачать Excel
        </a>
      </div>

      <WeeklyPoints key={group.group.id} group={group} from={range.from} to={range.to} />

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-96" />}

      {data && (
        <>
          {group.students.length === 0 ? (
            <EmptyState icon={<CalendarCheckIcon size={28} />} title="Пока нечего считать">
              Добавьте {t.student.many.acc} и проведите первый урок.
            </EmptyState>
          ) : (
            <div className={`card overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead className="border-b border-line text-sm text-ink-soft">
                  <tr>
                    {th('name', cap(t.student.one.nom), 'sticky left-0 bg-surface')}
                    {th('earned', 'Плюсы', 'text-right')}
                    <th className="px-3 py-3 text-right font-semibold">Минусы</th>
                    {th('net', 'Итого', 'text-right')}
                    <th className="px-3 py-3 text-right font-semibold">Уровень</th>
                    {th('attendance', 'Посещаемость')}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-b border-line/60 last:border-0">
                      <td className="sticky left-0 bg-surface px-3 py-2.5">
                        <Link to={`/s/${s.id}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${s.earned ? 'text-plus' : 'text-ink-soft'}`}>{s.earned ? `+${s.earned}` : '0'}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${s.lost ? 'text-minus' : 'text-ink-soft'}`}>{s.lost ? `−${s.lost}` : '0'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{s.net}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.level}</td>
                      <td className="px-3 py-2.5">
                        {s.sessions ? (
                          <span className="flex items-center gap-3">
                            <span className="w-14 tabular-nums">
                              {s.attended}/{s.sessions}
                            </span>
                            <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-2">
                              <span className="block h-full rounded-full bg-plus" style={{ width: `${(s.attendanceRate ?? 0) * 100}%` }} />
                            </span>
                          </span>
                        ) : (
                          <span className="text-ink-soft">нет отметок</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-lg">Уроки за период</h2>
            {data.sessions.length === 0 ? (
              <p className="text-ink-soft">Посещаемость за этот период не отмечалась.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...data.sessions].reverse().map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                    <span className="font-medium">
                      {formatDate(s.date)}
                      {(s.lesson > 1 || data.sessions.some((o) => o.date === s.date && o.id !== s.id)) && (
                        <span className="block text-sm font-normal text-ink-soft">{s.lesson}-й урок</span>
                      )}
                    </span>
                    <span className="text-right text-sm text-ink-soft">
                      <span className="block font-semibold text-ink tabular-nums">
                        {s.presentCount} из {s.studentsTotal}
                      </span>
                      {s.peopleOnPhoto !== null ? `на фото ${s.peopleOnPhoto}` : 'без фото'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
