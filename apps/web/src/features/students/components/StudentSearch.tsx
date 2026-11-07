import { useId } from 'react';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { useTerms } from '../../auth';

export function StudentSearch({ value, onChange, found, total }: {
  value: string; onChange: (query: string) => void; found: number; total: number;
}) {
  const t = useTerms();
  const id = useId();
  return (
    <div className="max-w-md space-y-2">
      <label className="sr-only" htmlFor={id}>Поиск {t.student.one.gen}</label>
      <div className="relative">
        <MagnifyingGlassIcon size={20} className="pointer-events-none absolute left-4 top-3.5 text-ink-soft" aria-hidden />
        <input id={id} type="search" className="input pl-11 pr-12 [&::-webkit-search-cancel-button]:appearance-none" autoComplete="off" placeholder="Имя, фамилия или логин" value={value} onChange={(e) => onChange(e.target.value)} />
        {value && <button className="icon-btn absolute right-1 top-0.5 bg-surface" aria-label="Очистить поиск" onClick={() => onChange('')}><XIcon size={18} /></button>}
      </div>
      {value.trim() && <p role="status" className="text-sm text-ink-soft">Найдено: {found} из {total}</p>}
    </div>
  );
}
