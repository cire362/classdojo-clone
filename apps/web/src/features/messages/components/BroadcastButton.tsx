import { useState, type FormEvent } from 'react';
import { MegaphoneSimpleIcon } from '@phosphor-icons/react';
import { pluralize } from '../../../lib/hooks';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { broadcast } from '../api';
import { prepareAttachments } from '../attachments';
import { AttachmentPicker } from './Attachments';
import { SendLater } from './SendLater';

/** Сообщение всем родителям группы: каждому в его обычную переписку, отвечают туда же */
export function BroadcastButton({ groupId }: { groupId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [later, setLater] = useState(false);
  const [sendAt, setSendAt] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ready = await prepareAttachments(files);
      const at = later ? new Date(sendAt).toISOString() : undefined;
      const { sent } = await broadcast(groupId, { text: text.trim(), sendAt: at, files: ready });
      const whom = `${sent} ${pluralize(sent, 'родителю', 'родителям', 'родителям')}`;
      toast({ text: later ? `Запланировано: ${whom}` : `Отправлено: ${whom}`, tone: 'ok' });
      setOpen(false);
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

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <MegaphoneSimpleIcon size={18} aria-hidden /> Написать родителям
      </button>
      <Modal open={open} title="Сообщение всем родителям" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-ink-soft">
            Каждый родитель получит сообщение в своей переписке и ответит лично вам, другие ответы не увидит.
          </p>
          <div>
            <label className="label" htmlFor="broadcast-text">Сообщение</label>
            <textarea
              id="broadcast-text"
              className="input min-h-32 resize-y"
              maxLength={2000}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
          </div>
          <SendLater on={later} at={sendAt} onToggle={setLater} onTime={setSendAt} />
          <button className="btn btn-primary" disabled={busy || (!text.trim() && !files.length) || (later && !sendAt)}>
            {later ? 'Запланировать' : 'Отправить всем'}
          </button>
        </form>
      </Modal>
    </>
  );
}
