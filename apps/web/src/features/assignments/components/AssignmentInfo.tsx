import { CalendarBlankIcon, StarIcon } from '@phosphor-icons/react';
import type { Assignment } from '../../../lib/api';
import { formatDate, pluralize } from '../../../lib/hooks';
import { AttachedFiles } from '../../../ui/Attachments';

/** Срок и баллы задания одной строкой */
export function AssignmentMeta({ assignment, overdue = false }: { assignment: Assignment; overdue?: boolean }) {
  const { dueOn, points } = assignment;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
      {dueOn && (
        <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-minus' : ''}`}>
          <CalendarBlankIcon size={16} aria-hidden /> {overdue ? 'Срок прошёл' : 'Сдать до'}: {formatDate(dueOn)}
        </span>
      )}
      {points > 0 && (
        <span className="inline-flex items-center gap-1">
          <StarIcon size={16} aria-hidden /> {points} {pluralize(points, 'балл', 'балла', 'баллов')} за выполнение
        </span>
      )}
    </p>
  );
}

/** Описание и файлы задания */
export function AssignmentBody({ assignment }: { assignment: Assignment }) {
  return (
    <>
      {assignment.description && <p className="whitespace-pre-line break-words">{assignment.description}</p>}
      {assignment.files.length > 0 && <AttachedFiles files={assignment.files} />}
    </>
  );
}
