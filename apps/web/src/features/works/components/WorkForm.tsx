import { useId, useState, type FormEvent } from 'react';
import type { StudentWork } from '../../../lib/api';
import { prepareAttachments } from '../../../lib/attachments';
import { AttachmentPicker } from '../../../ui/Attachments';
import { useToast } from '../../../ui/Toast';
import { submitWork } from '../api';

/** Сдача работы: название, текст и до пяти фото или PDF. Хотя бы текст или файл */
export function WorkForm({ onSubmitted }: { onSubmitted: (works: StudentWork[]) => void }) {
  const id = useId();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ready = await prepareAttachments(files);
      onSubmitted(await submitWork({ title: title.trim(), text: text.trim(), files: ready }));
      setTitle('');
      setText('');
      setFiles([]);
      toast({ text: 'Работа отправлена преподавателю', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg">Новая работа</h2>
      <p className="text-sm text-ink-soft">Её увидит преподаватель. Родители увидят работу, когда преподаватель её опубликует.</p>
      <div>
        <label className="label" htmlFor={`${id}-name`}>Название</label>
        <input id={`${id}-name`} className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-text`}>Текст, если нужен</label>
        <textarea
          id={`${id}-text`}
          className="input min-h-24 resize-y"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
      </div>
      <button className="btn btn-primary" disabled={busy || !title.trim() || (!text.trim() && !files.length)}>
        Отправить преподавателю
      </button>
    </form>
  );
}
