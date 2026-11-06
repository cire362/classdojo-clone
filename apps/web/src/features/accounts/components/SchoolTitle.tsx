import { useId, useState, type FormEvent } from 'react';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { fetchSchool, renameSchool } from '../api';

/** Название школы администратора: всё в кабинете относится только к ней. Название можно поменять */
export function SchoolTitle() {
  const id = useId();
  const toast = useToast();
  const { data, setData } = useLoad(() => fetchSchool(), []);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setData(await renameSchool(name.trim()));
      setEditing(false);
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Skeleton className="h-9 w-64" />;
  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor={`${id}-name`}>Название школы</label>
          <input id={`${id}-name`} className="input" maxLength={120} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy || !name.trim()}>Сохранить</button>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Отмена</button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="min-w-0 break-words text-2xl sm:text-3xl">{data.name}</h1>
      <button
        className="icon-btn"
        aria-label="Переименовать школу"
        title="Переименовать школу"
        onClick={() => {
          setName(data.name);
          setEditing(true);
        }}
      >
        <PencilSimpleIcon size={20} />
      </button>
    </div>
  );
}
