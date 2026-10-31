import { useState, type FormEvent } from 'react';
import { ShuffleIcon, TrashIcon } from '@phosphor-icons/react';
import { api, type LessonStudent, type Team } from '../../../lib/api';
import { useToast } from '../../../ui/Toast';
import { Modal } from '../../../ui';

/** Настройка команд: состав, названия, случайное распределение поровну */
export function TeamsModal({
  open,
  groupId,
  teams,
  students,
  onClose,
  onSaved,
}: {
  open: boolean;
  groupId: string;
  teams: Team[];
  students: LessonStudent[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [list, setList] = useState(teams);
  const [assign, setAssign] = useState<Record<string, string | null>>(() => Object.fromEntries(students.map((s) => [s.id, s.teamId])));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState({ teams, students });
  // Свежие данные группы при каждом открытии
  if (open && (key.teams !== teams || key.students !== students)) {
    setKey({ teams, students });
    setList(teams);
    setAssign(Object.fromEntries(students.map((s) => [s.id, s.teamId])));
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const base = `/teacher/groups/${groupId}/teams`;
  const add = (e: FormEvent) => {
    e.preventDefault();
    const submitted = name;
    void run(async () => {
      setList(await api<Team[]>('POST', base, { name: submitted.trim() }));
      // Если пока шёл запрос уже начали вводить следующую команду — не стираем её
      setName((current) => (current === submitted ? '' : current));
    });
  };
  const rename = (t: Team, value: string) =>
    value.trim() && value.trim() !== t.name && run(async () => setList(await api<Team[]>('PATCH', `${base}/${t.id}`, { name: value.trim() })));
  const remove = (t: Team) =>
    run(async () => {
      setList(await api<Team[]>('DELETE', `${base}/${t.id}`));
      setAssign(Object.fromEntries(Object.entries(assign).map(([s, id]) => [s, id === t.id ? null : id])));
    });

  /** Поровну и случайно: перемешиваем учеников и раздаём по кругу */
  function shuffle() {
    const ids = students.map((s) => s.id).sort(() => Math.random() - 0.5);
    setAssign(Object.fromEntries(ids.map((id, i) => [id, list[i % list.length].id])));
  }

  const save = () =>
    run(async () => {
      await api('PUT', `${base}/assign`, { assignments: assign });
      await onSaved();
      toast({ text: 'Состав команд сохранён', tone: 'ok' });
      onClose();
    });

  return (
    <Modal open={open} title="Команды" onClose={onClose} size="lg">
      <div className="space-y-6">
        <section className="space-y-3">
          {list.length > 0 && (
            <ul className="space-y-2">
              {list.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span aria-hidden className="size-4 shrink-0 rounded-full" style={{ background: t.color }} />
                  <label className="sr-only" htmlFor={`team-${t.id}`}>
                    Название команды
                  </label>
                  <input id={`team-${t.id}`} className="input py-2" defaultValue={t.name} maxLength={30} onBlur={(e) => rename(t, e.target.value)} />
                  <button className="icon-btn" title="Удалить команду" aria-label={`Удалить команду ${t.name}`} disabled={busy} onClick={() => remove(t)}>
                    <TrashIcon size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.length < 6 && (
            <form onSubmit={add} className="flex gap-2">
              <label className="sr-only" htmlFor="new-team">
                Новая команда
              </label>
              <input id="new-team" className="input py-2" placeholder="Новая команда, например «Кометы»" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn btn-secondary shrink-0" disabled={busy || !name.trim()}>
                Добавить
              </button>
            </form>
          )}
        </section>

        {list.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base">Состав</h3>
              <button className="btn btn-ghost btn-sm" onClick={shuffle}>
                <ShuffleIcon size={18} /> Распределить поровну случайно
              </button>
            </div>
            <ul className="card max-h-[40dvh] divide-y divide-line overflow-y-auto">
              {students.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                  <label className="min-w-0 flex-1 truncate font-medium" htmlFor={`assign-${s.id}`}>
                    {s.name}
                  </label>
                  <select
                    id={`assign-${s.id}`}
                    className="input w-44 py-2"
                    value={assign[s.id] ?? ''}
                    onChange={(e) => setAssign({ ...assign, [s.id]: e.target.value || null })}
                  >
                    <option value="">Без команды</option>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              Сохранить состав
            </button>
          </section>
        )}
      </div>
    </Modal>
  );
}
