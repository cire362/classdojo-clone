import { useState, type FormEvent } from 'react';
import { WarningIcon } from '@phosphor-icons/react';
import type { FeedPost } from '../../../lib/api';
import { localDateTime } from '../../../lib/hooks';
import { prepareImage } from '../../../lib/photo';
import { videoPoster } from '../../../lib/video';
import { useToast } from '../../../ui/Toast';
import { createPost, type PostFiles } from '../api';
import { MediaPicker, type PickedMedia } from './MediaPicker';

const MAX = 2000;
/** Как на сервере: больше не нужно для экрана и проектора */
const PHOTO_SIDE = 2048;

/** noPhotoNames: ученики, чьи фото нельзя публиковать. Лиц система не распознаёт, поэтому это напоминание */
export function PostForm({ postTo, noPhotoNames = [], onPosted }: {
  postTo: string;
  noPhotoNames?: string[];
  onPosted: (post: FeedPost) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [later, setLater] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [busy, setBusy] = useState(false);

  async function publish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // По одному: несколько больших снимков сразу заняли бы много памяти телефона
      const files: PostFiles = { photos: [] };
      for (const item of media) {
        if (item.kind === 'photo') files.photos.push(await prepareImage(item.file, PHOTO_SIDE));
        else files.video = { file: item.file, poster: await videoPoster(item.file) };
      }
      onPosted(await createPost(postTo, text.trim(), later ? new Date(publishAt).toISOString() : undefined, files));
      media.forEach((m) => URL.revokeObjectURL(m.url));
      setText('');
      setMedia([]);
      setLater(false);
      setPublishAt('');
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={publish} className="card space-y-3 p-4">
      <label className="label" htmlFor="post-text">
        Объявление для учеников и родителей
      </label>
      <textarea
        id="post-text"
        className="input min-h-24 resize-y"
        placeholder="Например: в пятницу урок переносится на 15:00"
        maxLength={MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <MediaPicker media={media} onChange={setMedia} disabled={busy} />
      {media.length > 0 && noPhotoNames.length > 0 && (
        <p className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>Проверьте снимки и видео. Нельзя публиковать: {noPhotoNames.join(', ')}.</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
          Опубликовать позже
        </label>
        {later && (
          <input
            type="datetime-local"
            className="input w-auto"
            aria-label="Дата и время публикации"
            min={localDateTime()}
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-soft tabular-nums">{text.length > MAX - 200 ? `${text.length} / ${MAX}` : ''}</span>
        <button className="btn btn-primary" disabled={busy || (!text.trim() && !media.length) || (later && !publishAt)}>
          {busy && media.length ? 'Загружаем…' : later ? 'Запланировать' : 'Опубликовать'}
        </button>
      </div>
    </form>
  );
}
