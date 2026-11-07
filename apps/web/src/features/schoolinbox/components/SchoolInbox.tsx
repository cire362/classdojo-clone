import { useState } from 'react';
import { ArrowLeftIcon, CheckIcon } from '@phosphor-icons/react';
import type { InboxThread, InboxThreadDetail } from '../../../lib/api';
import { formatDateTime, useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { Thread } from '../../messages';
import { useNotifications } from '../../notifications';
import { fetchInbox, fetchInboxThread, markHandled, replyFromSchool } from '../api';
import { useTerms } from '../../auth';

/** Открытая переписка: ответ уходит от имени сотрудника, «Решено» снимает ожидание без письма */
function InboxConversation({ id, onBack }: { id: string; onBack: () => void }) {
  const toast = useToast();
  const { refresh } = useNotifications();
  const { data, error, reload, setData } = useLoad(() => fetchInboxThread(id), [id]);
  const [busy, setBusy] = useState(false);
  const update = (detail: InboxThreadDetail) => {
    setData(detail);
    void refresh();
    return detail.messages;
  };

  async function handled() {
    setBusy(true);
    try {
      update(await markHandled(id));
      toast({ text: 'Вопрос отмечен решённым', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-3xl space-y-3" aria-labelledby="inbox-thread-title">
      <button className="btn btn-ghost btn-sm" onClick={onBack}>
        <ArrowLeftIcon size={18} aria-hidden /> Все переписки
      </button>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="inbox-thread-title" className="min-w-0 break-words text-lg">{data.family}</h2>
            {data.waiting && (
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={handled}>
                <CheckIcon size={18} aria-hidden /> Решено без ответа
              </button>
            )}
          </div>
          <Thread
            messages={data.messages}
            send={async (message) => update(await replyFromSchool(id, message))}
            emptyText="Сообщений нет."
          />
        </>
      )}
    </section>
  );
}

function Row({ thread, onOpen }: { thread: InboxThread; onOpen: () => void }) {
  return (
    <button className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left hover:bg-surface-2" onClick={onOpen}>
      <span className="min-w-0 flex-1 basis-60">
        <span className="block break-words font-semibold">{thread.family}</span>
        <span className="block truncate text-sm text-ink-soft">
          {thread.lastFromSchool ? 'Администрация: ' : ''}
          {thread.lastText}
        </span>
      </span>
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        {thread.waiting && <span className="chip bg-accent text-on-accent">Ждёт ответа</span>}
        {formatDateTime(thread.lastMessageAt)}
      </span>
    </button>
  );
}

/** Единый ящик школы: письма семей видит и отвечает любой сотрудник администрации. Ждущие ответа — сверху */
export function SchoolInbox() {
  const { data, error, reload } = useLoad(() => fetchInbox(), []);
  const [open, setOpen] = useState<string | null>(null);
  const t = useTerms();
  if (open) return <InboxConversation id={open} onBack={() => { setOpen(null); void reload(); }} />;
  const waiting = data?.filter((t) => t.waiting).length ?? 0;
  return (
    <section className="max-w-3xl space-y-4" aria-labelledby="inbox-title">
      <div className="space-y-1">
        <h2 id="inbox-title" className="text-lg">
          Ящик {t.org.one.gen} {data && <span className="text-ink-soft">(ждут ответа: {waiting})</span>}
        </h2>
        <p className="text-sm text-ink-soft">
          Семьи пишут сюда со страницы «Письмо в {t.org.one.acc}». Ответить может любой сотрудник администрации.
        </p>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && data.length === 0 && <p className="text-ink-soft">Писем пока нет.</p>}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden" aria-label="Переписки с семьями">
          {data.map((t) => <li key={t.id}><Row thread={t} onOpen={() => setOpen(t.id)} /></li>)}
        </ul>
      )}
    </section>
  );
}
