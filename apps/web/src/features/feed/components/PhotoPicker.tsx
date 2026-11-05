import { useEffect, useRef } from 'react';
import { ImageIcon, XIcon } from '@phosphor-icons/react';
import { useToast } from '../../../ui/Toast';

export const MAX_PHOTOS = 10;

export type PickedPhoto = { file: File; url: string };

/** Выбор фото для записи с миниатюрами. Адреса миниатюр освобождаются, когда фото убирают */
export function PhotoPicker({ photos, onChange, disabled }: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(photos);
  current.current = photos;
  useEffect(() => () => current.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function add(files: FileList | null) {
    const picked = [...(files ?? [])].filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - photos.length;
    if (picked.length > room) toast({ text: `В записи может быть не больше ${MAX_PHOTOS} фото`, tone: 'error' });
    onChange([...photos, ...picked.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    if (input.current) input.current.value = '';
  }
  function remove(index: number) {
    URL.revokeObjectURL(photos[index].url);
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Выбранные фото">
          {photos.map((p, i) => (
            <li key={p.url} className="relative">
              <img src={p.url} alt={`Фото ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-ink/70 text-bg"
                aria-label={`Убрать фото ${i + 1}`}
                disabled={disabled}
                onClick={() => remove(i)}
              >
                <XIcon size={16} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={disabled || photos.length >= MAX_PHOTOS}
        onClick={() => input.current?.click()}
      >
        <ImageIcon size={18} aria-hidden /> {photos.length ? 'Ещё фото' : 'Фото'}
      </button>
    </div>
  );
}
