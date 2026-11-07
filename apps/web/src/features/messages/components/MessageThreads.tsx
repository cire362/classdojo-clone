import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ChatsCircleIcon } from '@phosphor-icons/react';
import { Thread } from './Thread';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { formatDateTime, useLoad } from '../../../lib/hooks';
import { CountBadge, useNotifications } from '../../notifications';
import { STUDENT_THREAD, cancelMessage, fetchTeacherThread, fetchThreads, sendTeacherMessage } from '../api';
import { cap } from '@heroes/shared/terms';
import { useTerms } from '../../auth';

/** Переписки с родителями и студентами по всем группам преподавателя */
export function MessageThreads() {
  const t = useTerms();
  const { data, error, reload } = useLoad(() => fetchThreads(), []);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl sm:text-3xl">Сообщения</h1>
      <h2 className="sr-only">Переписки</h2>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-40" />}
      {data?.length === 0 && (
        <EmptyState icon={<ChatsCircleIcon size={28} />} title="Сообщений пока нет">
          Родители пишут из своего кабинета. Написать родителю первым можно из карточки {t.student.one.gen}, в разделе «Родители».
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.map((th) => (
            <li key={`${th.studentId}|${th.parentId}`}>
              <Link
                to={`/messages/${th.studentId}/${th.parentId ?? STUDENT_THREAD}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate ${th.unread ? 'font-bold' : 'font-semibold'}`}>
                      {th.parentId ? 'Родители' : cap(t.student.one.nom)}: {th.studentName}
                    </span>
                    <CountBadge count={th.unread} label="новых" />
                  </span>
                  <span className="block truncate text-sm text-ink-soft">
                    {th.groupName} · {th.lastText}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-soft">{formatDateTime(th.lastAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ThreadView() {
  const t = useTerms();
  const { studentId, parentId } = useParams();
  const own = parentId === STUDENT_THREAD;
  const { refresh } = useNotifications();
  const { data, error, reload } = useLoad(async () => {
    const thread = await fetchTeacherThread(studentId!, parentId!);
    void refresh();
    return thread;
  }, [studentId, parentId]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-80 max-w-2xl" />;
  return (
    <div className="max-w-2xl space-y-4">
      <Link to="/messages" className="btn btn-ghost btn-sm -ml-3">
        <ArrowLeftIcon size={18} /> Все сообщения
      </Link>
      <div>
        <h1 className="text-2xl sm:text-3xl">{own ? cap(t.student.one.nom) : 'Родители'}: {data.studentName}</h1>
        <p className="mt-1 text-ink-soft">
          {data.group.name}
          {data.parentLogin && <> · вход <span className="font-mono">{data.parentLogin}</span></>}.
          {' '}Переписку видят все преподаватели группы.
        </p>
      </div>
      <Thread
        messages={data.messages}
        emptyText={`Напишите первое сообщение — ${own ? t.student.one.nom : 'родители'} увидят его в своём кабинете.`}
        send={(message) => sendTeacherMessage(studentId!, parentId!, message)}
        cancel={(messageId) => cancelMessage(studentId!, parentId!, messageId)}
      />
    </div>
  );
}
