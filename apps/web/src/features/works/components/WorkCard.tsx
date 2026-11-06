import type { ReactNode } from 'react';
import { ArrowUUpLeftIcon, CheckCircleIcon, HourglassIcon } from '@phosphor-icons/react';
import type { StudentWork, WorkStatus } from '../../../lib/api';
import { formatDateTime } from '../../../lib/hooks';
import { AttachedFiles } from '../../../ui/Attachments';

const STATUS: Record<WorkStatus, { label: string; icon: typeof CheckCircleIcon; className: string }> = {
  PENDING: { label: 'На проверке', icon: HourglassIcon, className: 'bg-surface-2 text-ink' },
  APPROVED: { label: 'Опубликована', icon: CheckCircleIcon, className: 'bg-plus-bg text-plus' },
  RETURNED: { label: 'Вернули на доработку', icon: ArrowUUpLeftIcon, className: 'bg-minus-bg text-minus' },
};

/** Работа: название, текст, файлы и, если нужно, состояние проверки с комментарием преподавателя */
export function WorkCard({ work, heading, showStatus = true, level = 3, answer = false, children }: {
  work: StudentWork;
  /** Ответ на задание: его не публикуют, а принимают */
  answer?: boolean;
  /** Уровень заголовка работы: под заголовком раздела третьего уровня — четвёртый */
  level?: 3 | 4;
  /** Над названием: например, имя ученика в очереди преподавателя */
  heading?: ReactNode;
  showStatus?: boolean;
  children?: ReactNode;
}) {
  const { icon: Icon, className } = STATUS[work.status];
  const label = answer && work.status === 'APPROVED' ? 'Принят' : STATUS[work.status].label;
  const Title = level === 3 ? 'h3' : 'h4';
  return (
    <li className="card space-y-2 p-4">
      {heading}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Title className="min-w-0 break-words text-lg">{work.title}</Title>
        {showStatus && (
          <span className={`chip text-xs ${className}`}>
            <Icon size={14} aria-hidden /> {label}
            {work.unseen && <span className="sr-only">, новое решение</span>}
          </span>
        )}
      </div>
      <p className="text-sm text-ink-soft">{formatDateTime(work.createdAt)}</p>
      {work.text && <p className="whitespace-pre-line break-words">{work.text}</p>}
      {work.files.length > 0 && <AttachedFiles files={work.files} />}
      {work.comment && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <span className="font-semibold">{work.decidedBy ?? 'Преподаватель'}:</span> {work.comment}
        </p>
      )}
      {children}
    </li>
  );
}
