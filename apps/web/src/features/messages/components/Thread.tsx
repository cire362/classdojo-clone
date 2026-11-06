import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ClockIcon, PaperPlaneRightIcon } from '@phosphor-icons/react';
import type { ChatMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import type { Outgoing } from '../api';
import { prepareAttachments } from '../../../lib/attachments';
import { AttachedFiles, AttachmentPicker } from '../../../ui/Attachments';
import { SendLater } from './SendLater';

/** Переписка: сообщения и поле ответа. send возвращает обновлённую ветку; cancel есть только у преподавателя */
export function Thread({ messages, send, cancel, emptyText }: {
  messages: ChatMessage[];
  send: (message: Outgoing) => Promise<ChatMessage[]>;
  cancel?: (messageId: string) => Promise<ChatMessage[]>;
  emptyText: string;
}) {
  const toast = useToast();
  const [list, setList] = useState(messages);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);
  const [sendAt, setSendAt] = useState('');
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => setList(messages), [messages]);
  // Прокручиваем к последнему сообщению только сам список, не страницу
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [list.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ready = await prepareAttachments(files);
      setList(await send({ text: text.trim(), sendAt: later ? new Date(sendAt).toISOString() : undefined, files: ready }));
      setText('');
      setFiles([]);
      setLater(false);
      setSendAt('');
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      setList(await cancel!(id));
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <ol ref={box} className="max-h-[60dvh] min-h-40 space-y-3 overflow-y-auto p-4" aria-label="Сообщения">
        {list.length === 0 && <li className="py-8 text-center text-sm text-ink-soft">{emptyText}</li>}
        {list.map((m) => (
          <li key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.mine ? 'bg-accent/25' : 'bg-surface-2'}`}>
              {/* На цветном фоне своего сообщения приглушённый текст не проходит по контрасту */}
              <div className={`text-xs ${m.mine ? 'text-ink' : 'text-ink-soft'}`}>
                <span className="font-semibold text-ink">{m.mine ? 'Вы' : m.author}</span> · {formatDateTime(m.createdAt)}
              </div>
              {m.text && <p className="mt-1 whitespace-pre-line break-words">{m.text}</p>}
              {m.files.length > 0 && <AttachedFiles files={m.files} />}
              {m.scheduled && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <ClockIcon size={14} aria-hidden /> Уйдёт в это время
                  </span>
                  {m.mine && cancel && (
                    <button className="font-semibold underline" onClick={() => remove(m.id)}>Отменить отправку</button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="space-y-2 border-t border-line p-3">
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="message-text">
            Сообщение
          </label>
          <textarea
            id="message-text"
            className="input min-h-12 flex-1 resize-y"
            rows={1}
            maxLength={2000}
            placeholder="Сообщение"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
            }}
          />
          <button
            className="btn btn-primary shrink-0"
            disabled={busy || (!text.trim() && !files.length) || (later && !sendAt)}
            aria-label="Отправить"
          >
            <PaperPlaneRightIcon size={20} weight="fill" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
          {cancel && <SendLater on={later} at={sendAt} onToggle={setLater} onTime={setSendAt} />}
        </div>
      </form>
    </div>
  );
}
