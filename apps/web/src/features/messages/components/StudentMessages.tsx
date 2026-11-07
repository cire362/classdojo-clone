import { useEffect } from 'react';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useNotifications } from '../../notifications';
import { fetchOwnMessages, sendOwnMessage } from '../api';
import { Thread } from './Thread';

/** Переписка студента колледжа или вуза с преподавателями группы: родитель в ней не участвует */
export function StudentMessages() {
  const { data, error, reload } = useLoad(() => fetchOwnMessages(), []);
  const { refresh } = useNotifications();
  useEffect(() => {
    if (data) void refresh();
  }, [data, refresh]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl">Сообщения</h1>
        <p className="text-ink-soft">Переписку видят все преподаватели вашей группы. Вопросы администрации — в «Письме».</p>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && <Thread messages={data} send={sendOwnMessage} emptyText="Напишите преподавателям группы: ответ придёт сюда." />}
    </div>
  );
}
