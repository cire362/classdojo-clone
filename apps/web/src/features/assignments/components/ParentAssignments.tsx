import { ClipboardTextIcon } from '@phosphor-icons/react';
import type { AnswerStatus } from '../../../lib/api';
import { formatDateTime, useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { AttachedFiles } from '../../../ui/Attachments';
import { fetchChildAssignments } from '../api';
import { AssignmentBody, AssignmentMeta } from './AssignmentInfo';

const STATUS: Record<AnswerStatus, { label: string; className: string }> = {
  NONE: { label: 'Не сдано', className: 'bg-surface-2 text-ink' },
  PENDING: { label: 'На проверке', className: 'bg-surface-2 text-ink' },
  APPROVED: { label: 'Принято', className: 'bg-plus-bg text-plus' },
  RETURNED: { label: 'На доработке', className: 'bg-minus-bg text-minus' },
};

/**
 * Задания ребёнка для родителя: что задано, к какому сроку, сдано ли и что сказал преподаватель.
 * Ответ показывается, только когда его приняли: до проверки его видят ученик и преподаватели
 */
export function ParentAssignments({ childId }: { childId: string }) {
  const { data, error, reload } = useLoad(() => fetchChildAssignments(childId), [childId]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-48 max-w-2xl" />;
  if (!data.length) {
    return (
      <EmptyState icon={<ClipboardTextIcon size={28} />} title="Заданий пока нет">
        Здесь появятся задания, которые преподаватель выдаст ребёнку.
      </EmptyState>
    );
  }
  return (
    <ul className="max-w-2xl space-y-3" aria-label="Задания ребёнка">
      {data.map((a) => (
        <li key={a.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 break-words text-lg">{a.title}</h2>
            <span className={`chip text-xs ${STATUS[a.status].className}`}>{STATUS[a.status].label}</span>
          </div>
          <AssignmentMeta assignment={a} overdue={a.overdue} />
          <AssignmentBody assignment={a} />
          {a.accepted && (
            <section aria-label="Принятый ответ" className="space-y-2 rounded-xl border border-line p-3">
              <p className="text-sm text-ink-soft">Ответ от {formatDateTime(a.accepted.createdAt)}</p>
              {a.accepted.text && <p className="whitespace-pre-line break-words">{a.accepted.text}</p>}
              {a.accepted.files.length > 0 && <AttachedFiles files={a.accepted.files} />}
            </section>
          )}
          {a.comment && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="font-semibold">Преподаватель:</span> {a.comment}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
