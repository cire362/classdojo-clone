import { useState, type KeyboardEvent } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { fileUrl } from '../../../lib/files';
import { Modal } from '../../../ui';

/** Одно фото во всю ширину, два — пополам, больше — по три в ряд на широком экране */
const GRID = (count: number) => (count === 1 ? '' : count === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3');

/** Фото записи: превью сеткой, по нажатию — снимок целиком со стрелками */
export function PostPhotos({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!ids.length) return null;
  const count = ids.length;
  const shown = open ?? 0;
  const go = (by: number) => setOpen((shown + by + count) % count);
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };

  return (
    <>
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
    </>
  );
}
