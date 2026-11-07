import { useRef, useState } from 'react';
import { FileArrowUpIcon, UserPlusIcon } from '@phosphor-icons/react';
import { useToast } from '../../../ui/Toast';
import { previewImport } from '../api';
import type { ImportPreview } from './ImportStudentsModal';
import { useTerms } from '../../auth';

/** Добавление учеников списком или файлом из журнала */
export function AddStudentsPanel({ groupId, busy, onAdd, onPreview }: {
  groupId: string;
  busy: boolean;
  onAdd: (names: string[]) => Promise<boolean>;
  onPreview: (preview: ImportPreview) => void;
}) {
  const t = useTerms();
  const toast = useToast();
  const [names, setNames] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const parsed = names
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);

  async function add() {
    if (await onAdd(parsed)) setNames('');
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      onPreview(await previewImport(groupId, file));
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section className="h-fit rounded-2xl border border-dashed border-line p-5 lg:sticky lg:top-24">
      <h2 className="flex items-center gap-2 text-lg">
        <UserPlusIcon size={22} /> Добавить {t.student.many.acc}
      </h2>
      <label className="label mt-4" htmlFor="names">
        Имена, по одному на строку
      </label>
      <textarea
        id="names"
        className="input min-h-44 resize-y leading-relaxed"
        placeholder={'Маша Иванова\nАртём Ковалёв\nЗлата Волкова'}
        value={names}
        onChange={(e) => setNames(e.target.value)}
      />
      <p className="mt-2 text-sm text-ink-soft">Можно вставить список из таблицы или журнала.</p>
      <button className="btn btn-primary mt-4 w-full" disabled={busy || parsed.length === 0} onClick={add}>
        {busy ? 'Создаём…' : parsed.length ? `Добавить ${parsed.length}` : 'Добавить'}
      </button>
      <div className="mt-5 border-t border-line pt-5">
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          aria-label={`Файл со списком ${t.student.many.gen}`}
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => onImportFile(e.target.files?.[0])}
        />
        <button className="btn btn-secondary w-full" disabled={importing} onClick={() => fileInput.current?.click()}>
          <FileArrowUpIcon size={20} /> {importing ? 'Читаем файл…' : 'Загрузить Excel или CSV'}
        </button>
        <p className="mt-2 text-sm text-ink-soft">Подойдёт выгрузка из электронного журнала с колонкой «ФИО» или «Фамилия» и «Имя».</p>
      </div>
    </section>
  );
}
