import { useId, useState, type FormEvent } from 'react';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { INSTITUTION_KINDS, TERMS, termsFor, type InstitutionKind } from '@heroes/shared/terms';
import type { SchoolInfo } from '../../../lib/api';
import { useToast } from '../../../ui/Toast';
import { updateSchool } from '../api';

/**
 * Название и тип учреждения: всё в кабинете относится только к нему. Менять их может руководитель.
 * Тип задаёт слова интерфейса для всех: класс или группа, ученик или студент
 */
export function SchoolTitle({ school, onChange }: { school: SchoolInfo; onChange: (school: SchoolInfo) => void }) {
  const id = useId();
  const toast = useToast();
  const terms = termsFor(school.kind);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; kind: InstitutionKind }>({ name: '', kind: school.kind });
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onChange(await updateSchool({ name: form.name.trim(), kind: form.kind }));
      setEditing(false);
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-60">
          <label className="label" htmlFor={`${id}-name`}>Название</label>
          <input
            id={`${id}-name`}
            className="input"
            maxLength={120}
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="basis-56">
          <label className="label" htmlFor={`${id}-kind`}>Тип учреждения</label>
          <select
            id={`${id}-kind`}
            className="input"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as InstitutionKind })}
          >
            {INSTITUTION_KINDS.map((kind) => <option key={kind} value={kind}>{TERMS[kind].kindName}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={busy || !form.name.trim()}>Сохранить</button>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Отмена</button>
      </form>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 break-words text-2xl sm:text-3xl">{school.name}</h1>
        {school.role === 'DIRECTOR' && (
          <button
            className="icon-btn"
            aria-label="Изменить название и тип"
            title="Изменить название и тип"
            onClick={() => {
              setForm({ name: school.name, kind: school.kind });
              setEditing(true);
            }}
          >
            <PencilSimpleIcon size={20} />
          </button>
        )}
      </div>
      <p className="text-sm text-ink-soft">{terms.kindName}</p>
    </div>
  );
}
