import { useRef } from 'react';
import { FilePdfIcon, PaperclipIcon, XIcon } from '@phosphor-icons/react';
import type { FileInfo } from '../../../lib/api';
import { fileUrl, formatSize } from '../../../lib/files';
import { useToast } from '../../../ui/Toast';
import { MAX_ATTACHMENTS, rejectReason } from '../attachments';

/** Кнопка «Прикрепить» и выбранные файлы с кнопкой «Убрать» */
export function AttachmentPicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    const picked: File[] = [];
    for (const file of list ?? []) {
      const reason = rejectReason(file);
      if (reason) toast({ text: reason, tone: 'error' });
      else picked.push(file);
    }
    const room = MAX_ATTACHMENTS - files.length;
    if (picked.length > room) toast({ text: `К сообщению можно приложить не больше ${MAX_ATTACHMENTS} файлов`, tone: 'error' });
    onChange([...files, ...picked.slice(0, room)]);
    if (input.current) input.current.value = '';
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={disabled || files.length >= MAX_ATTACHMENTS}
        onClick={() => input.current?.click()}
      >
        <PaperclipIcon size={18} aria-hidden /> Прикрепить
      </button>
      {files.length > 0 && (
        <ul className="flex basis-full flex-wrap gap-2" aria-label="Выбранные файлы">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex max-w-full items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-sm">
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-line"
                aria-label={`Убрать ${file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <XIcon size={14} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Вложения сообщения: фото миниатюрами, PDF строкой с размером. Открываются в новой вкладке */
export function MessageFiles({ files }: { files: FileInfo[] }) {
  const photos = files.filter((f) => f.mime.startsWith('image/'));
  const documents = files.filter((f) => !f.mime.startsWith('image/'));
  return (
    <div className="mt-2 space-y-2">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Фото">
          {photos.map((f, i) => (
            <li key={f.id}>
              <a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg bg-surface-2">
                <img src={fileUrl(f.id, true)} alt={`Фото ${i + 1}: ${f.name}`} loading="lazy" className="size-24 object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {documents.map((f) => (
        <a
          key={f.id}
          href={fileUrl(f.id)}
          download={f.name}
          className="flex items-center gap-2 rounded-lg bg-surface/70 px-3 py-2 text-sm font-semibold hover:underline"
        >
          <FilePdfIcon size={22} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">{f.name}</span>
          <span className="ml-auto shrink-0 font-normal">{formatSize(f.size)}</span>
        </a>
      ))}
    </div>
  );
}
