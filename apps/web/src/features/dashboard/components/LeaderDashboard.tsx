import { useState } from 'react';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { cap } from '@heroes/shared/terms';
import type { DashboardBy } from '../../../lib/api';
import { dateKey, useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useTerms } from '../../auth';
import { fetchDashboard } from '../api';

const percent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function monthStart() {
  const now = new Date();
  return dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** Панель руководителя: вовлечённость, посещаемость и баллы по группам, курсам и подразделениям, выгрузка */
export function LeaderDashboard() {
  const t = useTerms();
  const [range, setRange] = useState(() => ({ from: monthStart(), to: dateKey() }));
  const [by, setBy] = useState<DashboardBy>('group');
  const { data, error, reload } = useLoad(() => fetchDashboard(by, range.from, range.to), [by, range.from, range.to]);
  const query = new URLSearchParams({ by, ...range }).toString();
  const cuts: [DashboardBy, string][] = [
    ['group', cap(t.group.many.nom)],
    ['course', t.kind === 'SCHOOL' ? 'Параллели' : 'Курсы'],
    ...(t.kind === 'SCHOOL' ? [] : [['department', cap(t.department.many.nom)] as [DashboardBy, string]]),
  ];
  const tiles = data && [
    ['Вовлечённость', percent(data.total.engagement)],
    ['Посещаемость', percent(data.total.attendance)],
    ['Плюсы', `+${data.total.earned}`],
    ['Минусы', data.total.lost ? `−${data.total.lost}` : '0'],
  ];

  return (
    <section className="space-y-5" aria-labelledby="overview-title">
      <h2 id="overview-title" className="text-lg">Обзор {t.org.one.gen}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs" htmlFor="overview-by">Разрез</label>
          <select id="overview-by" className="input py-2" value={by} onChange={(e) => setBy(e.target.value as DashboardBy)}>
            {cuts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs" htmlFor="overview-from">С</label>
          <input
            id="overview-from"
            type="date"
            className="input py-2"
            value={range.from}
            max={range.to}
            onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })}
          />
        </div>
        <div>
          <label className="label text-xs" htmlFor="overview-to">По</label>
          <input
            id="overview-to"
            type="date"
            className="input py-2"
            value={range.to}
            min={range.from}
            onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/admin/dashboard.xlsx?${query}`} className="btn btn-secondary" download>
            <DownloadSimpleIcon size={20} weight="bold" /> Excel
          </a>
          <a href={`/api/admin/dashboard.pdf?${query}`} className="btn btn-secondary" download>
            <DownloadSimpleIcon size={20} weight="bold" /> PDF
          </a>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && tiles && (
        <>
          <dl className="grid grid-cols-2 rounded-2xl border border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
            {tiles.map(([label, value]) => (
              <div key={label} className="px-4 py-3">
                <dt className="text-sm text-ink-soft">{label}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-ink-soft">
            Вовлечённость — доля {t.student.many.gen}, получивших хотя бы один плюс за период. Учитываются действующие {t.group.many.nom}.
          </p>
          {data.rows.length === 0 ? (
            <p className="text-ink-soft">Действующих {t.group.many.gen} пока нет.</p>
          ) : (
            <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Таблица обзора">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead className="border-b border-line text-sm text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{cuts.find(([value]) => value === by)?.[1]}</th>
                    {['Групп', cap(t.student.many.nom), 'Вовлечённость', 'Уроков', 'Посещаемость', 'Плюсы', 'Минусы'].map((h) => (
                      <th key={h} className="px-4 py-3 text-right font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...data.rows, data.total].map((r) => (
                    <tr key={r.key} className={r === data.total ? 'font-semibold' : ''}>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.groups}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.students}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{percent(r.engagement)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.lessons}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{percent(r.attendance)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-plus">+{r.earned}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-minus">{r.lost ? `−${r.lost}` : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
