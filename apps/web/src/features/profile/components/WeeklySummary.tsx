import { useState } from 'react';
import { ArrowClockwiseIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import type { ParentChild } from '../../../lib/api';
import { formatDate, pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchWeeklySummary } from '../api';

const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
const fullDate = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });

/** Монтируется с key ребёнка, чтобы его недели и незавершённые запросы не переходили к другому. */
export function WeeklySummary({ child }: { child: Pick<ParentChild, 'id' | 'name' | 'groupName'> }) {
  const [week, setWeek] = useState<string | undefined>();
  const { data, error, loading, reload } = useLoad(async () => ({
    query: week,
    report: await fetchWeeklySummary(child.id, week),
  }), [child.id, week]);
  const report = data && data.query === week && data.report.studentId === child.id ? data.report : null;
  return <section aria-labelledby="weekly-title" className="max-w-4xl space-y-6">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 id="weekly-title" className="text-2xl sm:text-3xl">Итог недели</h1>
        <p className="mt-2 break-words text-ink-soft">{child.name}, {child.groupName}</p>
      </div>
      <button className="icon-btn shrink-0 disabled:pointer-events-none disabled:opacity-40" aria-label="Обновить итог недели" disabled={loading} onClick={() => void reload()}><ArrowClockwiseIcon size={22} aria-hidden /></button>
    </div>
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <button className="icon-btn mb-1 shrink-0 disabled:pointer-events-none disabled:opacity-40" aria-label="Предыдущая неделя" disabled={!report || loading} onClick={() => setWeek(report!.previousWeek)}><CaretLeftIcon size={22} aria-hidden /></button>
        <label className="grid min-w-0 gap-1 text-sm font-medium">Неделя с
          <input type="date" className="input w-44 max-w-full" value={report?.from ?? week ?? ''} max={data?.report.currentFrom} onChange={(e) => { if (e.target.value) setWeek(e.target.value); }} />
        </label>
        <button className="icon-btn mb-1 shrink-0 disabled:pointer-events-none disabled:opacity-40" aria-label="Следующая неделя" disabled={!report?.nextWeek || loading} onClick={() => setWeek(report!.nextWeek!)}><CaretRightIcon size={22} aria-hidden /></button>
        <button className="btn btn-secondary btn-sm mb-1" onClick={() => { if (week === undefined) void reload(); else setWeek(undefined); }}>Текущая неделя</button>
      </div>
      <p className="text-xs text-ink-soft">С понедельника по воскресенье, по московскому времени.</p>
    </div>
    {error && !loading ? <ErrorBox message={error} onRetry={reload} /> : !report || loading ? <div aria-label="Загрузка итога недели" className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-52" /></div> : <>
      <div role="status" className="space-y-1">
        <p className="font-semibold">{fullDate(report.from)} — {fullDate(report.to)}</p>
        {report.isCurrent && <p className="text-sm text-ink-soft">Неделя ещё идёт. Здесь показаны уже внесённые записи.</p>}
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-surface-2 p-4 sm:p-5">
        {[
          ['Начислено', `+${report.points.earned}`, 'text-plus'],
          ['Списано', report.points.lost ? `−${report.points.lost}` : '0', 'text-minus'],
          ['Итого', signed(report.points.net), 'text-ink'],
        ].map(([label, value, color]) => <div key={label} className="min-w-0"><dt className="text-sm text-ink-soft">{label}</dt><dd className={`mt-1 break-words text-2xl font-semibold tabular-nums sm:text-3xl ${color}`}>{value}</dd></div>)}
      </dl>
      <section aria-labelledby="weekly-reasons" className="space-y-3">
        <h2 id="weekly-reasons" className="font-sans text-lg font-semibold">За что начислены и списаны баллы</h2>
        {!report.reasons.length ? <p className="text-ink-soft">За эту неделю начислений и списаний пока нет.</p> : <ul className="divide-y divide-line">
          {report.reasons.map((reason) => <li key={JSON.stringify([reason.name, reason.emoji])} className="flex items-center gap-3 py-3">
            <span aria-hidden className="w-7 shrink-0 text-center text-xl">{reason.emoji}</span>
            <div className="min-w-0 flex-1"><p className="break-words font-medium">{reason.name}</p><p className="text-sm text-ink-soft">{reason.count} {pluralize(reason.count, 'запись', 'записи', 'записей')}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-semibold tabular-nums">
              {reason.earned > 0 && <span className="text-plus">+{reason.earned}</span>}
              {reason.lost > 0 && <span className="text-minus">−{reason.lost}</span>}
            </div>
          </li>)}
        </ul>}
      </section>
      <section aria-labelledby="weekly-attendance" className="space-y-3">
        <h2 id="weekly-attendance" className="font-sans text-lg font-semibold">Посещаемость</h2>
        {report.attendance.total ? <>
          <p>Посещено <b className="tabular-nums">{report.attendance.attended} из {report.attendance.total}</b> {pluralize(report.attendance.total, 'урока', 'уроков', 'уроков')}. Пропущено: <b className="tabular-nums">{report.attendance.missed}</b>.</p>
          <ul className="divide-y divide-line">
            {report.attendance.records.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="break-words font-medium">{formatDate(r.date)}, {r.lesson}-й урок</p><p className="break-words text-sm text-ink-soft">{r.groupName}</p></div>
              <span className={`chip shrink-0 ${r.present ? 'bg-plus-bg text-plus' : 'bg-surface-2 text-ink-soft'}`}>{r.present ? 'Посещение' : 'Пропуск'}</span>
            </li>)}
          </ul>
        </> : <p className="text-ink-soft">Отметок за эту неделю пока нет.</p>}
        <p className="text-sm text-ink-soft">Уроки без отметки не считаются пропусками.</p>
      </section>
    </>}
  </section>;
}
