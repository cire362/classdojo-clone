import { useEffect, useId, useRef, useState } from 'react';
import { api, type GroupDetails, type WeeklyStats } from '../api';
import { pluralize, useLoad } from '../hooks';
import { ErrorBox, Skeleton } from '../ui';

type Metric = 'earned' | 'lost' | 'net';
const METRICS: [Metric, string][] = [['earned', 'Плюсы'], ['lost', 'Минусы'], ['net', 'Итого']];
const signed = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
const shortDate = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;
const fullDate = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' });

/** Целочисленная шкала с обязательным нулём, в том числе для одних минусов/нулей. */
export function weeklyScale(values: number[]) {
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const rough = (max - min) / 4 || 1;
  const base = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((n) => n * base).find((n) => n >= rough)!);
  const bottom = Math.floor(min / step) * step;
  const top = max === min ? step : Math.ceil(max / step) * step;
  const ticks = [];
  for (let n = bottom; n <= top; n += step) ticks.push(n);
  return { ticks, y: (n: number) => (top - n) / (top - bottom) * 100 };
}

export function WeeklyPoints({ group, from, to }: { group: GroupDetails; from: string; to: string }) {
  const [selection, setSelection] = useState('group');
  const [metric, setMetric] = useState<Metric>('earned');
  const [selectedWeek, setSelectedWeek] = useState('');
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const id = useId();
  const params = new URLSearchParams({ from, to });
  if (selection.startsWith('student:')) params.set('studentId', selection.slice(8));
  if (selection.startsWith('team:')) params.set('teamId', selection.slice(5));
  const query = params.toString();
  const { data, loading, error, reload } = useLoad(async () => ({ query, report: await api<WeeklyStats>('GET', `/teacher/groups/${group.group.id}/stats/weekly?${query}`) }), [group.group.id, query]);
  const report = data?.query === query && data.report.groupId === group.group.id ? data.report : null;
  const active = report?.weeks.find((w) => w.week === selectedWeek) ?? report?.weeks.at(-1);
  const value = (w: WeeklyStats['weeks'][number]) => metric === 'lost' ? -w.lost : w[metric];
  const scale = weeklyScale(report?.weeks.map(value) ?? [0]);
  const total = report ? metric === 'lost' ? -report.points.lost : report.points[metric] : 0;
  useEffect(() => {
    const index = report?.weeks.findIndex((w) => w.week === active?.week) ?? -1;
    if (scroller.current && index >= 0) scroller.current.scrollLeft = Math.max(0, (buttons.current[index]?.offsetLeft ?? 0) - scroller.current.clientWidth / 2);
  }, [report]);

  return <section aria-labelledby={`${id}-title`} className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 id={`${id}-title`} className="text-xl">Динамика по неделям</h2><p className="mt-1 text-sm text-ink-soft">Недели начинаются в понедельник, даты — по Москве.</p></div>
      <label className="grid min-w-0 gap-1 text-sm font-medium">Кого показать
        <select className="input max-w-full sm:w-72" value={selection} onChange={(e) => setSelection(e.target.value)}>
          <option value="group">Вся группа</option>
          {group.teams.length > 0 && <optgroup label="Команды">{group.teams.map((t) => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>}
          <optgroup label="Ученики">{group.students.map((s) => <option key={s.id} value={`student:${s.id}`}>{s.name}</option>)}</optgroup>
        </select>
      </label>
    </div>
    <div role="group" aria-label="Баллы на графике" className="flex gap-1">{METRICS.map(([key, label]) => <button key={key} className={`tab ${metric === key ? 'active' : 'bg-surface-2'}`} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</button>)}</div>
    {error && !loading ? <ErrorBox message={error} onRetry={reload} /> : loading || !report || !active ? <Skeleton className="h-80" /> : <>
      <p className="break-words text-sm text-ink-soft">{report.scope.name} · {report.members} {pluralize(report.members, 'ученик', 'ученика', 'учеников')} · за период: <b className="text-ink tabular-nums">{signed(total)}</b></p>
      {!report.points.events && <p className="text-ink-soft">За этот период начислений и списаний нет. На графике — нулевые недели.</p>}
      <p id={`${id}-help`} className="sr-only">Выберите неделю. Стрелки влево и вправо переключают недели; Home и End переходят к первой и последней.</p>
      <div className="flex min-w-0 gap-2">
        <div aria-hidden className="relative h-52 w-10 shrink-0 text-right text-xs text-ink-soft tabular-nums">{scale.ticks.map((n) => <span key={n} className="absolute right-0 -translate-y-1/2" style={{ top: `${scale.y(n)}%` }}>{n}</span>)}</div>
        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto pb-1" role="group" aria-label="Недели на графике" aria-describedby={`${id}-help`}>
          <div className="relative" style={{ minWidth: Math.max(280, report.weeks.length * 56) }}>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-52">{scale.ticks.map((n) => <div key={n} className={`absolute inset-x-0 border-t ${n === 0 ? 'border-ink-soft' : 'border-line'}`} style={{ top: `${scale.y(n)}%` }} />)}</div>
            <div className="relative grid" style={{ gridTemplateColumns: `repeat(${report.weeks.length}, minmax(0, 1fr))` }}>
              {report.weeks.map((w, i) => {
                const n = value(w), y = scale.y(n), zero = scale.y(0), current = active.week === w.week;
                return <button key={w.week} ref={(node) => { buttons.current[i] = node; }} className={`min-w-0 rounded-lg text-xs tabular-nums hover:bg-surface-2/60 focus-visible:z-10 focus-visible:outline-offset-[-3px] ${current ? 'bg-accent/15' : ''}`} aria-pressed={current} tabIndex={current ? 0 : -1} aria-label={`${shortDate(w.week)}${w.partial ? '*' : ''}. ${fullDate(w.from)} — ${fullDate(w.to)}: ${signed(n)}${w.partial ? ', неполная неделя' : ''}`} onFocus={() => setSelectedWeek(w.week)} onClick={() => setSelectedWeek(w.week)} onKeyDown={(e) => {
                  const next = e.key === 'ArrowLeft' ? Math.max(0, i - 1) : e.key === 'ArrowRight' ? Math.min(report.weeks.length - 1, i + 1) : e.key === 'Home' ? 0 : e.key === 'End' ? report.weeks.length - 1 : null;
                  if (next !== null) { e.preventDefault(); buttons.current[next]?.focus(); }
                }}>
                  <span className="relative block h-52" aria-hidden><span className={`absolute left-1/2 w-[56%] max-w-12 -translate-x-1/2 rounded-sm ${n > 0 ? 'bg-plus' : n < 0 ? 'bg-minus' : 'bg-ink-soft'}`} style={{ top: n ? `${Math.min(y, zero)}%` : `clamp(0px, ${zero}%, calc(100% - 2px))`, height: n ? `max(2px, ${Math.abs(y - zero)}%)` : '2px' }} /></span>
                  <span aria-hidden className="block py-2 text-ink-soft">{shortDate(w.week)}{w.partial ? '*' : ''}</span>
                </button>;
              })}
            </div>
          </div>
        </div>
      </div>
      <div role="status" className="space-y-1 rounded-xl bg-surface-2 p-4">
        <p className="font-medium">{fullDate(active.from)} — {fullDate(active.to)}{active.partial ? ' · неполная неделя' : ''}</p>
        <p className="text-sm tabular-nums">Начислено +{active.earned}, списано {active.lost ? `−${active.lost}` : '0'}, итого {signed(active.net)}.</p>
      </div>
      <p className="text-xs text-ink-soft">Состав группы и команд — текущий. * Неполная неделя учитывает только даты выбранного периода.</p>
      <details className="text-sm"><summary className="cursor-pointer font-medium">Данные графика таблицей</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left tabular-nums"><caption className="sr-only">Баллы по неделям: {report.scope.name}</caption><thead><tr className="border-b border-line"><th className="p-2">Период</th><th className="p-2">Плюсы</th><th className="p-2">Минусы</th><th className="p-2">Итого</th></tr></thead><tbody>{report.weeks.map((w) => <tr key={w.week} className="border-b border-line"><td className="p-2">{fullDate(w.from)} — {fullDate(w.to)}{w.partial ? '*' : ''}</td><td className="p-2">+{w.earned}</td><td className="p-2">{w.lost ? `−${w.lost}` : '0'}</td><td className="p-2">{signed(w.net)}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
