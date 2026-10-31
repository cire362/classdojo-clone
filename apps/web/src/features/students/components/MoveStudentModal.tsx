import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type GroupListItem } from '../../../lib/api';
import { pluralize } from '../../../lib/hooks';
import { HeroHead } from '../../hero';
import { Modal, Skeleton } from '../../../ui';

export interface MoveTarget {
  id: string;
  name: string;
  groupId: string;
}

/** Перевод ученика в другую группу этого же преподавателя */
export function MoveStudentModal({
  student,
  onClose,
  onMoved,
}: {
  student: MoveTarget | null;
  onClose: () => void;
  onMoved: (group: { id: string; name: string }) => void;
}) {
  const [groups, setGroups] = useState<GroupListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!student) return;
    setSelected(null);
    setError(null);
    setGroups(null);
    api<GroupListItem[]>('GET', '/teacher/groups')
      .then(setGroups)
      .catch((e) => setError((e as Error).message));
    // Перезагружаем список только при открытии окна для другого ученика
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const options = groups?.filter((g) => g.id !== student?.groupId) ?? [];

  async function move() {
    if (!student || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ groupId: string; groupName: string }>('POST', `/teacher/students/${student.id}/move`, { groupId: selected });
      onMoved({ id: r.groupId, name: r.groupName });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!student} title="Перевести в другую группу" onClose={onClose}>
      {student && (
        <div className="space-y-5">
          <p>
            <b>{student.name}</b> перейдёт в выбранную группу вместе с героем, баллами и историей. Логин и пароль не
            изменятся. Прошлые отметки посещаемости останутся в старой группе.
          </p>

          {!groups && !error && (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          )}

          {groups && options.length === 0 && (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
              Других групп пока нет.{' '}
              <Link to="/" className="font-semibold underline" onClick={onClose}>
                Создайте группу
              </Link>
              , и сюда можно будет перевести ученика.
            </p>
          )}

          {options.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="label">Куда перевести</legend>
              {options.map((g) => (
                <label
                  key={g.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                    selected === g.id ? 'border-ink bg-accent/15 ring-2 ring-ink' : 'border-line hover:border-ink-soft'
                  }`}
                >
                  <input
                    type="radio"
                    name="target-group"
                    className="sr-only"
                    checked={selected === g.id}
                    onChange={() => setSelected(g.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display">{g.name}</span>
                    <span className="block text-sm text-ink-soft">
                      {g.studentsCount} {pluralize(g.studentsCount, 'ученик', 'ученика', 'учеников')}
                    </span>
                  </span>
                  <span className="flex -space-x-2" aria-hidden>
                    {g.previewHeroes.slice(0, 4).map((h, i) => (
                      <HeroHead key={i} parts={h} className="size-8 ring-2 ring-surface" />
                    ))}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-minus">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!selected || busy} onClick={move}>
              {busy ? 'Переводим…' : 'Перевести'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
