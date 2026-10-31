import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArchiveIcon, ArrowsLeftRightIcon, FileArrowUpIcon, KeyIcon, PencilSimpleIcon, PrinterIcon, TrashIcon, UserPlusIcon, UsersIcon } from '@phosphor-icons/react';
import { api, type Credentials, type LessonStudent, type ParentCredentials } from '../../lib/api';
import { HeroHead } from '../../features/hero';
import { GroupTeachersSection } from '../../features/groups';
import { ImportStudentsModal, type ImportPreview } from '../../features/students';
import { MoveStudentModal } from '../../features/students';
import { useToast } from '../../ui/Toast';
import { Modal, PageTitle } from '../../ui';
import { pluralize } from '../../lib/hooks';
import { StudentSearch } from '../../features/students';
import { matchesStudent } from '../../features/students';
import { useGroup } from '../../features/groups';
import { CredentialsTable } from '../../features/students';

export function StudentsPage() {
  const { data, reload } = useGroup();
  const toast = useToast();
  const navigate = useNavigate();
  const [names, setNames] = useState('');
  const [query, setQuery] = useState('');
  const visibleStudents = data.students.filter((s) => matchesStudent(s, query));
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Credentials[] | null>(null);
  const [editing, setEditing] = useState<LessonStudent | null>(null);
  const [deleting, setDeleting] = useState<LessonStudent | null>(null);
  const [moving, setMoving] = useState<LessonStudent | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [groupEdit, setGroupEdit] = useState(false);
  const [parentsConfirm, setParentsConfirm] = useState(false);
  const [parentsBusy, setParentsBusy] = useState(false);
  const withoutParents = data.students.filter((s) => s.parentsCount === 0).length;

  async function issueParents() {
    setParentsBusy(true);
    try {
      const r = await api<{ credentials: ParentCredentials[] }>('POST', `/teacher/groups/${data.group.id}/parents`);
      await reload();
      navigate(`/g/${data.group.id}/print`, { state: { parents: r.credentials } });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setParentsBusy(false);
    }
  }

  const parsed = names
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);

  async function addStudents(list = parsed) {
    setBusy(true);
    try {
      const r = await api<{ credentials: Credentials[] }>('POST', `/teacher/groups/${data.group.id}/students`, { names: list });
      setImportPreview(null);
      setIssued(r.credentials);
      if (list === parsed) setNames('');
      await reload();
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      setImportPreview(await api<ImportPreview>('POST', `/teacher/groups/${data.group.id}/students/import-preview`, form));
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function resetPassword(s: LessonStudent) {
    try {
      const c = await api<Credentials>('POST', `/teacher/students/${s.id}/reset-password`);
      setIssued([c]);
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="min-w-0 space-y-4">
        <PageTitle
          actions={
            data.students.length > 0 && (
              <>
                <Link to={`/g/${data.group.id}/print`} className="btn btn-secondary btn-sm">
                  <PrinterIcon size={18} /> Лист с логинами
                </Link>
                {!data.group.archivedAt && withoutParents > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setParentsConfirm(true)}>
                    <UsersIcon size={18} /> Входы родителям
                  </button>
                )}
              </>
            )
          }
        >
          {data.students.length} {pluralize(data.students.length, 'ученик', 'ученика', 'учеников')}
        </PageTitle>

        {data.students.length > 0 && <StudentSearch value={query} onChange={setQuery} found={visibleStudents.length} total={data.students.length} />}
        {data.students.length === 0 ? (
          <p className="text-ink-soft">Добавьте учеников справа. Логины и пароли создадутся автоматически.</p>
        ) : visibleStudents.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 p-5 text-ink-soft">Ученики не найдены. Попробуйте другое имя, фамилию или логин.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {visibleStudents.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap sm:px-4">
                <Link to={`/s/${s.id}`} className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
                  <HeroHead parts={s.hero.parts} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.name}</span>
                    <span className="block truncate font-mono text-sm text-ink-soft">{s.login}</span>
                  </span>
                </Link>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button className="icon-btn" title="Переименовать" aria-label={`Переименовать ${s.name}`} onClick={() => setEditing(s)}>
                    <PencilSimpleIcon size={20} />
                  </button>
                  <button className="icon-btn" title="Перевести в другую группу" aria-label={`Перевести ${s.name} в другую группу`} onClick={() => setMoving(s)}>
                    <ArrowsLeftRightIcon size={20} />
                  </button>
                  <button className="icon-btn" title="Новый пароль" aria-label={`Новый пароль для ${s.name}`} onClick={() => resetPassword(s)}>
                    <KeyIcon size={20} />
                  </button>
                  <button className="icon-btn hover:text-minus" title="Удалить" aria-label={`Удалить ${s.name}`} onClick={() => setDeleting(s)}>
                    <TrashIcon size={20} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button className="btn btn-ghost btn-sm" onClick={() => setGroupEdit(true)}>
          Настройки группы
        </button>
      </section>

      {data.group.archivedAt ? (
        <p className="h-fit rounded-2xl bg-surface-2 p-5 text-sm text-ink-soft">
          Группа в архиве, добавлять учеников нельзя. Перевести ученика в действующую группу можно кнопкой со стрелками.
        </p>
      ) : (
      <section className="h-fit rounded-2xl border border-dashed border-line p-5 lg:sticky lg:top-24">
        <h2 className="flex items-center gap-2 text-lg">
          <UserPlusIcon size={22} /> Добавить учеников
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
        <button className="btn btn-primary mt-4 w-full" disabled={busy || parsed.length === 0} onClick={() => addStudents()}>
          {busy ? 'Создаём…' : parsed.length ? `Добавить ${parsed.length}` : 'Добавить'}
        </button>
        <div className="mt-5 border-t border-line pt-5">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            aria-label="Файл со списком учеников"
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
      )}

      <Modal open={!!issued} title="Логины и пароли" onClose={() => setIssued(null)} size="lg">
        {issued && (
          <div className="space-y-4">
            <p className="rounded-xl bg-accent/25 px-4 py-3 text-sm font-medium">
              Пароли показываются только сейчас. Распечатайте или перепишите их. Позже можно выдать новые.
            </p>
            <CredentialsTable rows={issued} />
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/g/${data.group.id}/print`, { state: { credentials: issued } })}
              >
                <PrinterIcon size={20} /> Распечатать
              </button>
              <button className="btn btn-secondary" onClick={() => setIssued(null)}>
                Готово
              </button>
            </div>
          </div>
        )}
      </Modal>

      <RenameModal
        student={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
      />

      <Modal open={!!deleting} title="Удалить ученика?" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="space-y-5">
            <p>
              <b>{deleting.name}</b> будет удалён вместе с героем, баллами и посещаемостью. Это нельзя отменить.
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await api('DELETE', `/teacher/students/${deleting.id}`);
                    setDeleting(null);
                    await reload();
                  } catch (e) {
                    toast({ text: (e as Error).message, tone: 'error' });
                  }
                }}
              >
                Удалить
              </button>
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </Modal>

      <GroupSettingsModal open={groupEdit} onClose={() => setGroupEdit(false)} />

      <ImportStudentsModal
        preview={importPreview}
        busy={busy}
        onClose={() => setImportPreview(null)}
        onConfirm={(list) => addStudents(list)}
      />

      <Modal open={parentsConfirm} title="Входы для родителей" onClose={() => setParentsConfirm(false)}>
        <div className="space-y-5">
          <p>
            Создадим вход родителям {withoutParents} {pluralize(withoutParents, 'ученика', 'учеников', 'учеников')}, у кого его ещё нет,
            и откроем лист для печати — удобно раздать на родительском собрании.
          </p>
          <p className="text-sm text-ink-soft">
            Родители увидят героя, баллы, историю и посещаемость только своего ребёнка. Пароли показываются один раз.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={parentsBusy} onClick={issueParents}>
              {parentsBusy ? 'Создаём…' : 'Создать и распечатать'}
            </button>
            <button className="btn btn-secondary" onClick={() => setParentsConfirm(false)}>
              Отмена
            </button>
          </div>
        </div>
      </Modal>
      <MoveStudentModal
        student={moving && { id: moving.id, name: moving.name, groupId: data.group.id }}
        onClose={() => setMoving(null)}
        onMoved={async (g) => {
          const name = moving?.name.split(' ')[0];
          setMoving(null);
          await reload();
          toast({ text: `${name} теперь в группе ${g.name}`, tone: 'ok', action: { label: 'Открыть', run: () => navigate(`/g/${g.id}/students`) } });
        }}
      />
    </div>
  );
}

function RenameModal({ student, onClose, onSaved }: { student: LessonStudent | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  if (student && last !== student.id) {
    setLast(student.id);
    setName(student.name);
    setError(null);
  }
  return (
    <Modal open={!!student} title="Имя ученика" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api('PATCH', `/teacher/students/${student!.id}`, { name });
            onSaved();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div>
          <label className="label" htmlFor="student-name">
            Имя и фамилия
          </label>
          <input id="student-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          {error && <p className="mt-2 text-sm font-medium text-minus">{error}</p>}
        </div>
        <p className="text-sm text-ink-soft">Логин не меняется.</p>
        <button className="btn btn-primary" disabled={!name.trim()}>
          Сохранить
        </button>
      </form>
    </Modal>
  );
}

function GroupSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, reload } = useGroup();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(data.group.name);
  const [confirmDelete, setConfirmDelete] = useState('');
  return (
    <Modal open={open} title="Настройки группы" onClose={onClose}>
      <div className="space-y-8">
        <GroupTeachersSection groupId={data.group.id} isOwner={data.group.isOwner} />
        {data.group.isOwner && (
          <>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('PATCH', `/teacher/groups/${data.group.id}`, { name });
                  await reload();
                  onClose();
                } catch (err) {
                  toast({ text: (err as Error).message, tone: 'error' });
                }
              }}
            >
              <label className="label" htmlFor="group-rename">
                Название
              </label>
              <input id="group-rename" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <button className="btn btn-primary" disabled={!name.trim() || name === data.group.name}>
                Переименовать
              </button>
            </form>
            {!data.group.archivedAt && (
              <div className="space-y-3 rounded-2xl border border-line p-4">
                <h3 className="text-base">Архив</h3>
                <p className="text-sm text-ink-soft">
                  Для групп, которые закончили занятия. Группа уйдёт из списка на главной, баллы и посещаемость заморозятся, а
                  статистика, профили и Excel останутся. Ученики по-прежнему смогут входить. Вернуть группу можно в любой момент.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    await api('POST', `/teacher/groups/${data.group.id}/archive`);
                    navigate('/');
                  }}
                >
                  <ArchiveIcon size={20} /> Перенести в архив
                </button>
              </div>
            )}
            <div className="space-y-3 rounded-2xl border border-minus/30 p-4">
              <h3 className="text-base text-minus">Удаление группы</h3>
              <p className="text-sm text-ink-soft">
                Удалятся все ученики группы, их аккаунты, баллы и посещаемость. Введите название группы, чтобы подтвердить.
              </p>
              <input className="input" aria-label="Название группы для подтверждения" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} />
              <button
                className="btn btn-danger"
                disabled={confirmDelete !== data.group.name}
                onClick={async () => {
                  await api('DELETE', `/teacher/groups/${data.group.id}`);
                  navigate('/');
                }}
              >
                Удалить группу
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
