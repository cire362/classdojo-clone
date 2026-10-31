import { useId, useState, type FormEvent } from 'react';
import { CaretDownIcon, DownloadSimpleIcon, FilePdfIcon } from '@phosphor-icons/react';
import { fetchReport, saveReport } from '../student-report-download';

/** Небольшая панель в профиле преподавателя; период и ошибка сохраняются при повторе. */
export function StudentReport({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [today] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date()));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const invalid = !from || !to ? 'Укажите обе даты.' : from > to ? 'Начало периода позже конца.' : to > today ? 'Нельзя выбрать будущую дату.' : (+new Date(to) - +new Date(from)) / 86_400_000 >= 366 ? 'Выберите период не длиннее 366 дней.' : '';
  async function download(e: FormEvent) {
    e.preventDefault();
    if (busy || invalid) return;
    setBusy(true); setError('');
    try { saveReport(await fetchReport(studentId, from, to), `Отчёт ${studentName} ${from}_${to}.pdf`); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <details className="group card p-4 sm:p-5">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold"><FilePdfIcon size={22} aria-hidden />Отчёт в PDF<CaretDownIcon size={18} aria-hidden className="ml-auto transition-transform group-open:rotate-180" /></summary>
    <form onSubmit={download} className="mt-4 space-y-3" noValidate>
      <p className="max-w-2xl text-sm text-ink-soft">Баллы, причины начислений и посещаемость для родительского собрания. Период до 366 дней, даты по Москве.</p>
      <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
        <label htmlFor={`${id}-from`} className="grid min-w-0 gap-1 text-sm font-medium">С<input id={`${id}-from`} type="date" className="input min-w-0 px-3 sm:w-40" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} aria-describedby={`${id}-range`} /></label>
        <label htmlFor={`${id}-to`} className="grid min-w-0 gap-1 text-sm font-medium">По<input id={`${id}-to`} type="date" className="input min-w-0 px-3 sm:w-40" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} aria-describedby={`${id}-range`} /></label>
        <button className="btn btn-primary col-span-2 justify-self-start" disabled={busy || !!invalid}><DownloadSimpleIcon size={20} aria-hidden />{busy ? 'Готовим PDF…' : 'Скачать PDF'}</button>
      </div>
      <p id={`${id}-range`} className={`text-sm ${invalid ? 'text-minus' : 'text-ink-soft'}`}>{invalid || 'Уроки без отметки не считаются пропусками.'}</p>
      {error && <p role="alert" className="text-sm text-minus">{error}</p>}
    </form>
  </details>;
}
