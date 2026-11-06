import { useId, useState, type FormEvent } from 'react';
import { PaintBrushIcon } from '@phosphor-icons/react';
import type { StudentWork } from '../../../lib/api';
import { MAX_ATTACHMENTS, prepareAttachments } from '../../../lib/attachments';
import { Modal } from '../../../ui';
import { AttachmentPicker } from '../../../ui/Attachments';
import { useToast } from '../../../ui/Toast';
import { submitWork } from '../api';
import { EMPTY, type Drawing } from '../drawing';
import { DrawingPad } from './DrawingPad';

/**
 * Сдача работы: название, текст и до пяти фото, PDF или рисунков с холста. Хотя бы текст или файл.
 * answerTo — ответ на задание: название берёт задание, отправляет его send, заголовок формы ниже уровнем.
 */
export function WorkForm<T = StudentWork[]>({ onSubmitted, answerTo }: {
  onSubmitted: (result: T) => void;
  answerTo?: { send: (answer: { text: string; files: File[] }) => Promise<T> };
}) {
  const id = useId();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState<Drawing>(EMPTY);
  const [drawingOpen, setDrawingOpen] = useState(false);

  function attachDrawing(file: File) {
    setFiles([...files, file]);
    setDrawing(EMPTY);
    setDrawingOpen(false);
    if (!title.trim() && !answerTo) setTitle('Рисунок');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ready = await prepareAttachments(files);
      const work = { title: title.trim(), text: text.trim(), files: ready };
      onSubmitted(answerTo ? await answerTo.send(work) : ((await submitWork(work)) as T));
      setTitle('');
      setText('');
      setFiles([]);
      toast({ text: answerTo ? 'Ответ отправлен преподавателю' : 'Работа отправлена преподавателю', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4" aria-labelledby={`${id}-title`}>
      {answerTo ? (
        <h3 id={`${id}-title`} className="text-base">Ваш ответ</h3>
      ) : (
        <>
          <h2 id={`${id}-title`} className="text-lg">Новая работа</h2>
          <p className="text-sm text-ink-soft">Её увидит преподаватель. Родители увидят работу, когда преподаватель её опубликует.</p>
          <div>
            <label className="label" htmlFor={`${id}-name`}>Название</label>
            <input id={`${id}-name`} className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </>
      )}
      <div>
        <label className="label" htmlFor={`${id}-text`}>{answerTo ? 'Текст ответа, если нужен' : 'Текст, если нужен'}</label>
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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || files.length >= MAX_ATTACHMENTS}
          onClick={() => setDrawingOpen(true)}
        >
          <PaintBrushIcon size={18} aria-hidden /> {drawing.strokes.length ? 'Продолжить рисунок' : 'Нарисовать'}
        </button>
      </div>
      <Modal open={drawingOpen} title="Рисунок" size="lg" onClose={() => setDrawingOpen(false)}>
        <DrawingPad drawing={drawing} onChange={setDrawing} onDone={attachDrawing} />
      </Modal>
      <button className="btn btn-primary" disabled={busy || (!answerTo && !title.trim()) || (!text.trim() && !files.length)}>
        {answerTo ? 'Сдать ответ' : 'Отправить преподавателю'}
      </button>
    </form>
  );
}
