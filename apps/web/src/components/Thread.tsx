import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PaperPlaneRightIcon } from '@phosphor-icons/react';
import type { ChatMessage } from '../lib/api';
import { formatDateTime } from '../lib/hooks';
import { useToast } from '../ui/Toast';

/** Переписка: сообщения и поле ответа. send возвращает обновлённую ветку */
export function Thread({ messages, send, emptyText }: { messages: ChatMessage[]; send: (text: string) => Promise<ChatMessage[]>; emptyText: string }) {
  const toast = useToast();
  const [list, setList] = useState(messages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
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
      setList(await send(text.trim()));
      setText('');
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <ol ref={box} className="max-h-[60dvh] min-h-40 space-y-3 overflow-y-auto p-4" aria-label="Сообщения">
        {list.length === 0 && <li className="py-8 text-center text-sm text-ink-soft">{emptyText}</li>}
        {list.map((m) => (
          <li key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.mine ? 'bg-accent/25' : 'bg-surface-2'}`}>
              <div className="text-xs text-ink-soft">
                <span className="font-semibold text-ink">{m.mine ? 'Вы' : m.author}</span> · {formatDateTime(m.createdAt)}
              </div>
              <p className="mt-1 whitespace-pre-line break-words">{m.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
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
        <button className="btn btn-primary shrink-0" disabled={busy || !text.trim()} aria-label="Отправить">
          <PaperPlaneRightIcon size={20} weight="fill" />
        </button>
      </form>
    </div>
  );
}
