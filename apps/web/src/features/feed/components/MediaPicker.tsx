import { useEffect, useRef } from 'react';
import { FilmStripIcon, ImageIcon, XIcon } from '@phosphor-icons/react';
import { useToast } from '../../../ui/Toast';

export const MAX_MEDIA = 10;
/** Видео сервер не уменьшает: перекодирование потребовало бы библиотек с неподходящей лицензией */
export const MAX_VIDEO_MB = 100;

export type PickedMedia = { file: File; url: string; kind: 'photo' | 'video' };

const kindOf = (file: File) => (file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : null);

/** Выбор фото и одного видео для записи с миниатюрами. Адреса миниатюр освобождаются, когда файл убирают */
export function MediaPicker({ media, onChange, disabled }: {
  media: PickedMedia[];
  onChange: (media: PickedMedia[]) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(media);
  current.current = media;
  useEffect(() => () => current.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  function add(files: FileList | null) {
    const picked: PickedMedia[] = [];
    let hasVideo = media.some((m) => m.kind === 'video');
    for (const file of files ?? []) {
      const kind = kindOf(file);
      if (!kind) continue;
      if (kind === 'video') {
        if (hasVideo) {
          toast({ text: 'В записи может быть одно видео', tone: 'error' });
          continue;
        }
        if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
          toast({ text: `Видео больше ${MAX_VIDEO_MB} МБ: обрежьте его или снимите покороче`, tone: 'error' });
          continue;
        }
        hasVideo = true;
      }
      picked.push({ file, kind, url: URL.createObjectURL(file) });
    }
    const room = MAX_MEDIA - media.length;
    if (picked.length > room) toast({ text: `В записи может быть не больше ${MAX_MEDIA} фото и видео`, tone: 'error' });
    picked.slice(room).forEach((m) => URL.revokeObjectURL(m.url));
    onChange([...media, ...picked.slice(0, room)]);
    if (input.current) input.current.value = '';
  }
  function remove(index: number) {
    URL.revokeObjectURL(media[index].url);
    onChange(media.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {media.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Выбранные фото и видео">
          {media.map((m, i) => (
            <li key={m.url} className="relative">
              {m.kind === 'photo' ? (
                <img src={m.url} alt={`Фото ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <div
                  role="img"
                  aria-label={`Видео: ${m.file.name}`}
                  className={[
                    'flex aspect-square w-full flex-col items-center justify-center',
                    'gap-1 rounded-lg bg-surface-2 p-1 text-center text-xs',
                  ].join(' ')}
                >
                  <FilmStripIcon size={24} aria-hidden />
                  <span className="w-full truncate">{m.file.name}</span>
                </div>
              )}
              <button
                type="button"
                className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-ink/70 text-bg"
                aria-label={m.kind === 'photo' ? `Убрать фото ${i + 1}` : 'Убрать видео'}
                disabled={disabled}
                onClick={() => remove(i)}
              >
                <XIcon size={16} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,video/mp4,video/quicktime"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={disabled || media.length >= MAX_MEDIA}
        onClick={() => input.current?.click()}
      >
        <ImageIcon size={18} aria-hidden /> {media.length ? 'Ещё фото или видео' : 'Фото или видео'}
      </button>
    </div>
  );
}
