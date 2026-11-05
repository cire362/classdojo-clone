import { useState, type KeyboardEvent } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import type { FeedPost } from '../../../lib/api';
import { fileUrl } from '../../../lib/files';
import { Modal } from '../../../ui';

/** Одно фото во всю ширину, два — пополам, больше — по три в ряд на широком экране */
const GRID = (count: number) => (count === 1 ? '' : count === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3');

/** Видео записи с обложкой и фото сеткой; по нажатию фото открывается целиком со стрелками */
export function PostMedia({ media }: { media: FeedPost['media'] }) {
  const [open, setOpen] = useState<number | null>(null);
  const videos = media.filter((m) => m.kind === 'video');
  const ids = media.filter((m) => m.kind === 'photo').map((m) => m.id);
  const count = ids.length;
  const shown = open ?? 0;
  const go = (by: number) => setOpen((shown + by + count) % count);
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };

  return (
    <>
      {videos.map((v) => (
        // Без субтитров: ролики снимает преподаватель на уроке, расшифровки к ним нет
        <video
          key={v.id}
          src={fileUrl(v.id)}
          poster={fileUrl(v.id, true)}
          controls
          playsInline
          preload="none"
          aria-label="Видео"
          className="mt-3 max-h-[28rem] w-full rounded-xl bg-ink"
        />
      ))}
      {count > 0 && (
        <ul className={`mt-3 grid gap-1.5 ${GRID(count)}`} aria-label="Фото">
          {ids.map((id, i) => (
            <li key={id}>
              <button
                className="block w-full overflow-hidden rounded-xl bg-surface-2"
                aria-label={`Открыть фото ${i + 1} из ${count}`}
                onClick={() => setOpen(i)}
              >
                <img
                  src={fileUrl(id, true)}
                  alt=""
                  loading="lazy"
                  className={`w-full object-cover ${count === 1 ? 'max-h-96' : 'aspect-square'}`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {count > 0 && (
        <Modal open={open !== null} title={`Фото ${shown + 1} из ${count}`} size="lg" onClose={() => setOpen(null)}>
          <div onKeyDown={keys}>
            <img src={fileUrl(ids[shown])} alt={`Фото ${shown + 1} из ${count}`} className="mx-auto max-h-[70dvh] w-auto rounded-xl" />
            {count > 1 && (
              <div className="mt-3 flex justify-between gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => go(-1)}>
                  <CaretLeftIcon size={18} aria-hidden /> Назад
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => go(1)}>
                  Дальше <CaretRightIcon size={18} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
