import { useState } from 'react';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { TERMS } from '@heroes/shared/terms';
import { useOptionalAuth } from '../../auth';
import { dateKey, useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchNetworkOverview } from '../api';

const percent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function monthStart() {
  const now = new Date();
  return dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

const HEADERS = ['Тип', 'Групп', 'Обучающихся', 'Преподавателей', 'Вовлечённость', 'Посещаемость', 'Плюсы', 'Минусы'];

/** Кабинет руководителя сети: сводные показатели каждого учреждения сети за период и итог */
export function NetworkDashboard() {
  const user = useOptionalAuth()?.user;
  const [range, setRange] = useState(() => ({ from: monthStart(), to: dateKey() }));
  const { data, error, reload } = useLoad(() => fetchNetworkOverview(range.from, range.to), [range.from, range.to]);
  const query = new URLSearchParams(range).toString();
  const tiles = data && [
    ['Учреждений', String(data.schools.length)],
    ['Обучающихся', String(data.total.students)],
    ['Вовлечённость', percent(data.total.engagement)],
    ['Посещаемость', percent(data.total.attendance)],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">{data?.name ?? 'Сеть учреждений'}</h1>
        <p className="mt-2 text-ink-soft">
          {user ? `Здравствуйте, ${user.name}. ` : ''}Сводные показатели учреждений сети, без имён учеников.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs" htmlFor="network-from">С</label>
          <input
            id="network-from"
            type="date"
            className="input py-2"
            value={range.from}
            max={range.to}
            onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })}
          />
        </div>
        <div>
          <label className="label text-xs" htmlFor="network-to">По</label>
          <input
            id="network-to"
            type="date"
            className="input py-2"
            value={range.to}
            min={range.from}
            onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })}
          />
        </div>
        <a href={`/api/network/overview.xlsx?${query}`} className="btn btn-secondary" download>
          <DownloadSimpleIcon size={20} weight="bold" /> Excel
        </a>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && tiles && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map(([label, value]) => (
              <div key={label} className="card p-4">
                <dt className="text-sm text-ink-soft">{label}</dt>
                <dd className="mt-1 font-display text-2xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {data.schools.length === 0 ? (
            <p className="text-ink-soft">В сеть пока не добавлены учреждения.</p>
          ) : (
            <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Учреждения сети">
              <table className="w-full min-w-[760px] text-left text-[15px]">
                <thead className="border-b border-line text-sm text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Учреждение</th>
                    {HEADERS.map((h) => <th key={h} className="px-4 py-3 text-right font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...data.schools, { ...data.total, kind: null }].map((r) => (
                    <tr key={r.key} className={r.kind ? '' : 'font-semibold'}>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 text-right">{r.kind ? TERMS[r.kind].kindName : ''}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.groups}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.students}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.teachers}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{percent(r.engagement)}</td>
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
    </div>
  );
}
