import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ChatsCircleIcon } from '@phosphor-icons/react';
import { api, type ChatMessage, type TeacherThread, type ThreadSummary } from '../../../lib/api';
import { Thread } from './Thread';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { formatDateTime, useLoad } from '../../../lib/hooks';
import { CountBadge, useNotifications } from '../../notifications';

/** Переписки с родителями по всем группам преподавателя */
export function MessageThreads() {
  const { data, error, reload } = useLoad(() => api<ThreadSummary[]>('GET', '/teacher/messages'), []);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl sm:text-3xl">Сообщения</h1>
      <h2 className="sr-only">Переписки с родителями</h2>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-40" />}
      {data?.length === 0 && (
        <EmptyState icon={<ChatsCircleIcon size={28} />} title="Сообщений пока нет">
          Родители пишут из своего кабинета. Написать родителю первым можно из карточки ученика, в разделе «Родители».
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.map((t) => (
            <li key={`${t.studentId}|${t.parentId}`}>
              <Link to={`/messages/${t.studentId}/${t.parentId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate ${t.unread ? 'font-bold' : 'font-semibold'}`}>Родители: {t.studentName}</span>
                    <CountBadge count={t.unread} label="новых" />
                  </span>
                  <span className="block truncate text-sm text-ink-soft">
                    {t.groupName} · {t.lastText}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-soft">{formatDateTime(t.lastAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ThreadView() {
  const { studentId, parentId } = useParams();
  const { refresh } = useNotifications();
  const base = `/teacher/students/${studentId}/parents/${parentId}/messages`;
  const { data, error, reload } = useLoad(async () => {
    const thread = await api<TeacherThread>('GET', base);
    void refresh();
    return thread;
  }, [base]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-80 max-w-2xl" />;
  return (
    <div className="max-w-2xl space-y-4">
      <Link to="/messages" className="btn btn-ghost btn-sm -ml-3">
        <ArrowLeftIcon size={18} /> Все сообщения
      </Link>
      <div>
        <h1 className="text-2xl sm:text-3xl">Родители: {data.studentName}</h1>
        <p className="mt-1 text-ink-soft">
          {data.group.name} · вход <span className="font-mono">{data.parentLogin}</span>. Переписку видят все преподаватели группы.
        </p>
      </div>
      <Thread
        messages={data.messages}
        emptyText="Напишите первое сообщение — родители увидят его в своём кабинете."
        send={(text) => api<ChatMessage[]>('POST', base, { text })}
      />
    </div>
  );
}
