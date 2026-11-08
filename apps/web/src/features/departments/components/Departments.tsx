import { useState, type FormEvent } from 'react';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { cap } from '@heroes/shared/terms';
import type { Department } from '../../../lib/api';
import { pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useTerms } from '../../auth';
import { createDepartment, deleteDepartment, departmentTree, fetchDepartments, updateDepartment } from '../api';

type Editing = { id: string | null; name: string; parentId: string | null };

/**
 * Подразделения колледжа или вуза: факультеты и кафедры, отделения. Вложенность — один уровень.
 * Группы закрепляются за подразделением в разделе групп, сотрудники — в разделе администрации
 */
export function Departments({ canEdit }: { canEdit: boolean }) {
  const t = useTerms();
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => fetchDepartments(), []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const title = cap(t.department.many.nom);

  async function run(action: () => Promise<Department[]>, done: string) {
    setBusy(true);
    try {
      setData(await action());
      setEditing(null);
      toast({ text: done, tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const body = { name: editing.name.trim(), parentId: editing.parentId };
    void run(() => (editing.id ? updateDepartment(editing.id, body) : createDepartment(body)), 'Сохранено');
  }

  const tree = data ? departmentTree(data) : [];
  const row = (d: Department, nested: boolean) => (
    <li key={d.id} className={`flex flex-wrap items-center gap-3 p-4 ${nested ? 'pl-10' : ''}`}>
      <span className="min-w-0 flex-1 basis-48">
        <span className="block break-words font-semibold">{d.name}</span>
        <span className="block text-sm text-ink-soft">
          {d.groups} {pluralize(d.groups, 'группа', 'группы', 'групп')}
          {d.admins > 0 && ` · ${d.admins} ${pluralize(d.admins, 'сотрудник', 'сотрудника', 'сотрудников')}`}
        </span>
      </span>
      {canEdit && (
        <span className="flex gap-1">
          <button
            className="icon-btn"
            aria-label={`Изменить «${d.name}»`}
            onClick={() => setEditing({ id: d.id, name: d.name, parentId: d.parentId })}
          >
            <PencilSimpleIcon size={20} />
          </button>
          <button
            className="icon-btn hover:text-minus"
            aria-label={`Удалить «${d.name}»`}
            disabled={busy}
            onClick={() => run(() => deleteDepartment(d.id), 'Удалено: группы остались без подразделения')}
          >
            <TrashIcon size={20} />
          </button>
        </span>
      )}
    </li>
  );

  return (
    <section className="max-w-3xl space-y-4" aria-labelledby="departments-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="departments-title" className="text-lg">{title}</h2>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ id: null, name: '', parentId: null })}>
            <PlusIcon size={18} aria-hidden /> Добавить
          </button>
        )}
      </div>
      <p className="text-sm text-ink-soft">
        Внутри можно создать ещё один уровень, например кафедры факультета. {cap(t.departmentHead)} видит только группы своего
        подразделения: закрепите его в разделе «Администрация».
      </p>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-40" />}
      {data && data.length === 0 && <p className="text-ink-soft">Подразделений пока нет.</p>}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden" aria-label={title}>
          {tree.flatMap((d) => [row(d, false), ...d.children.map((c) => row(c, true))])}
        </ul>
      )}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Изменить подразделение' : 'Новое подразделение'}
        onClose={() => { if (!busy) setEditing(null); }}
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label" htmlFor="department-name">Название</label>
              <input
                id="department-name"
                className="input"
                maxLength={120}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="department-parent">Входит в</label>
              <select
                id="department-parent"
                className="input"
                value={editing.parentId ?? ''}
                onChange={(e) => setEditing({ ...editing, parentId: e.target.value || null })}
              >
                <option value="">Никуда, верхний уровень</option>
                {tree.filter((d) => d.id !== editing.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" disabled={busy || !editing.name.trim()}>Сохранить</button>
          </form>
        )}
      </Modal>
    </section>
  );
}
