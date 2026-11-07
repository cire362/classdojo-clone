import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardTextIcon, PlusIcon } from '@phosphor-icons/react';
import type { TeacherAssignment } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { useGroup } from '../../groups';
import { fetchGroupAssignments } from '../api';
import { AssignmentMeta } from './AssignmentInfo';
import { AssignmentForm } from './AssignmentForm';
import { useTerms } from '../../auth';
import { cap } from '@heroes/shared/terms';

/** Задания группы: новые сверху, у каждого — сколько ответов сдали и сколько ждут проверки */
export function GroupAssignments() {
  const t = useTerms();
  const { data: group } = useGroup();
  const archived = !!group.group.archivedAt;
  const { data, setData, error, reload } = useLoad(() => fetchGroupAssignments(group.group.id), [group.group.id]);
  const [creating, setCreating] = useState(false);
  const created = (list: TeacherAssignment[]) => {
    setData(list);
    setCreating(false);
  };

  return (
    <div className="max-w-2xl space-y-4">
      {!archived &&
        (creating ? (
          <AssignmentForm onCreated={created} />
        ) : (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon size={20} aria-hidden /> Новое задание
          </button>
        ))}
      {archived && <p className="text-sm text-ink-soft">Группа в архиве: новые задания выдавать и проверять ответы нельзя.</p>}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-32" />}
      {data?.length === 0 && (
        <EmptyState icon={<ClipboardTextIcon size={28} />} title="Заданий пока нет">
          Выдайте задание всей группе, команде или нескольким {t.student.many.dat}. {cap(t.student.many.nom)} сдадут ответ текстом, фото,
          файлом или рисунком.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3" aria-label="Задания">
          {data.map((a) => (
            <li key={a.id}>
              <Link to={a.id} className="card block space-y-1 p-4 transition hover:ring-2 hover:ring-line">
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-display text-lg">{a.title}</span>
                  {a.pending > 0 && <span className="chip bg-accent text-xs text-on-accent">На проверке: {a.pending}</span>}
                </span>
                <AssignmentMeta assignment={a} />
                <span className="block text-sm">
                  Сдали {a.pending + a.accepted + a.returned} из {a.assigned} · принято {a.accepted}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
