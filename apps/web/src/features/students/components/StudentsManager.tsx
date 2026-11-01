import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PrinterIcon, UsersIcon } from '@phosphor-icons/react';
import { IssueCardsButton } from '../../codes';
import { GroupSettingsModal, useGroup } from '../../groups';
import type { Credentials, LessonStudent } from '../../../lib/api';
import { pluralize } from '../../../lib/hooks';
import { PageTitle } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { addStudents, resetStudentPassword } from '../api';
import { matchesStudent } from '../student-search';
import { AddStudentsPanel } from './AddStudentsPanel';
import { DeleteStudentModal } from './DeleteStudentModal';
import { ImportStudentsModal, type ImportPreview } from './ImportStudentsModal';
import { IssuedCredentialsModal } from './IssuedCredentialsModal';
import { MoveStudentModal } from './MoveStudentModal';
import { ParentsIssueModal } from './ParentsIssueModal';
import { RenameModal } from './RenameModal';
import { StudentRoster } from './StudentRoster';
import { StudentSearch } from './StudentSearch';

export function StudentsManager() {
  const { data, reload } = useGroup();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const visibleStudents = data.students.filter((s) => matchesStudent(s, query));
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Credentials[] | null>(null);
  const [editing, setEditing] = useState<LessonStudent | null>(null);
  const [deleting, setDeleting] = useState<LessonStudent | null>(null);
  const [moving, setMoving] = useState<LessonStudent | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [groupEdit, setGroupEdit] = useState(false);
  const [parentsConfirm, setParentsConfirm] = useState(false);
  const withoutParents = data.students.filter((s) => s.parentsCount === 0).length;

  async function add(list: string[]) {
    setBusy(true);
    try {
      const r = await addStudents(data.group.id, list);
      setImportPreview(null);
      setIssued(r.credentials);
      await reload();
      return true;
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(s: LessonStudent) {
    try {
      setIssued([await resetStudentPassword(s.id)]);
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
                {!data.group.archivedAt && <IssueCardsButton groupId={data.group.id} className="btn btn-secondary btn-sm" />}
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
          <StudentRoster students={visibleStudents} onRename={setEditing} onMove={setMoving} onResetPassword={resetPassword} onDelete={setDeleting} />
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
        <AddStudentsPanel groupId={data.group.id} busy={busy} onAdd={add} onPreview={setImportPreview} />
      )}

      <IssuedCredentialsModal issued={issued} groupId={data.group.id} onClose={() => setIssued(null)} />

      <RenameModal
        student={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
      />

      <DeleteStudentModal student={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />

      <GroupSettingsModal open={groupEdit} onClose={() => setGroupEdit(false)} />

      <ImportStudentsModal
        preview={importPreview}
        busy={busy}
        onClose={() => setImportPreview(null)}
        onConfirm={(list) => add(list)}
      />

      <ParentsIssueModal
        open={parentsConfirm}
        groupId={data.group.id}
        withoutParents={withoutParents}
        onClose={() => setParentsConfirm(false)}
        onIssued={reload}
      />
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
