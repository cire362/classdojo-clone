import { useState } from 'react';
import { ClipboardTextIcon } from '@phosphor-icons/react';
import type { AnswerStatus, StudentAssignment } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { useNotifications } from '../../notifications';
import { WorkCard, WorkForm } from '../../works';
import { fetchStudentAssignments, submitAnswer } from '../api';
import { AssignmentBody, AssignmentMeta } from './AssignmentInfo';

const STATUS: Record<AnswerStatus, { label: string; className: string }> = {
  NONE: { label: 'Не сдано', className: 'bg-surface-2 text-ink' },
  PENDING: { label: 'На проверке', className: 'bg-surface-2 text-ink' },
  APPROVED: { label: 'Принято', className: 'bg-plus-bg text-plus' },
  RETURNED: { label: 'Вернули на доработку', className: 'bg-minus-bg text-minus' },
};

/**
 * Задания ученика: несданные и возвращённые раскрыты сразу, в них форма ответа. Открытый список
 * снимает значок новых заданий и решений
 */
export function StudentAssignments() {
  const { refresh } = useNotifications();
  const { data, setData, error, reload } = useLoad(async () => {
    const list = await fetchStudentAssignments();
    void refresh();
    return list;
  }, []);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (a: StudentAssignment) => open[a.id] ?? (a.status === 'NONE' || a.status === 'RETURNED');

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-48 max-w-2xl" />;
  if (!data.length) {
    return (
      <EmptyState icon={<ClipboardTextIcon size={28} />} title="Заданий пока нет">
        Когда преподаватель выдаст задание, оно появится здесь.
      </EmptyState>
    );
  }
  return (
    <ul className="max-w-2xl space-y-3" aria-label="Задания">
      {data.map((a) => {
        const status = STATUS[a.status];
        const canAnswer = a.status === 'NONE' || a.status === 'RETURNED';
        return (
          <li key={a.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="min-w-0 break-words text-lg">{a.title}</h2>
              <span className="flex flex-wrap gap-1.5">
                {a.isNew && <span className="chip bg-accent text-xs text-on-accent">Новое</span>}
                <span className={`chip text-xs ${status.className}`}>{status.label}</span>
              </span>
            </div>
            <AssignmentMeta assignment={a} overdue={a.overdue} />
            <button
              className="btn btn-ghost btn-sm -ml-3"
              aria-expanded={isOpen(a)}
              aria-label={`${isOpen(a) ? 'Свернуть' : 'Подробнее'}: ${a.title}`}
              onClick={() => setOpen({ ...open, [a.id]: !isOpen(a) })}
            >
              {isOpen(a) ? 'Свернуть' : 'Подробнее'}
            </button>
            {isOpen(a) && (
              <div className="space-y-3">
                <AssignmentBody assignment={a} />
                {a.works.length > 0 && (
                  <ul className="space-y-3" aria-label="Мои ответы">
                    {a.works.map((w) => <WorkCard key={w.id} work={w} answer level={3} />)}
                  </ul>
                )}
                {canAnswer && <WorkForm onSubmitted={setData} answerTo={{ send: (answer) => submitAnswer(a.id, answer) }} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
