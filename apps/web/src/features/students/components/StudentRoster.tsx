import { Link } from 'react-router-dom';
import { ArrowsLeftRightIcon, CameraSlashIcon, KeyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { HeroHead } from '../../hero';
import type { LessonStudent } from '../../../lib/api';

/** Список учеников с действиями над каждым */
export function StudentRoster({ students, onRename, onMove, onResetPassword, onDelete }: {
  students: LessonStudent[];
  onRename: (s: LessonStudent) => void;
  onMove: (s: LessonStudent) => void;
  onResetPassword: (s: LessonStudent) => void;
  onDelete: (s: LessonStudent) => void;
}) {
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {students.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap sm:px-4">
          <Link to={`/s/${s.id}`} className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
            <HeroHead parts={s.hero.parts} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{s.name}</span>
                {s.noPhotos && <CameraSlashIcon size={16} className="shrink-0 text-ink-soft" aria-label="Фото не публикуются" />}
              </span>
              <span className="block truncate font-mono text-sm text-ink-soft">{s.login}</span>
            </span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button className="icon-btn" title="Изменить" aria-label={`Изменить: ${s.name}`} onClick={() => onRename(s)}>
              <PencilSimpleIcon size={20} />
            </button>
            <button className="icon-btn" title="Перевести в другую группу" aria-label={`Перевести ${s.name} в другую группу`} onClick={() => onMove(s)}>
              <ArrowsLeftRightIcon size={20} />
            </button>
            <button className="icon-btn" title="Новый пароль" aria-label={`Новый пароль для ${s.name}`} onClick={() => onResetPassword(s)}>
              <KeyIcon size={20} />
            </button>
            <button className="icon-btn hover:text-minus" title="Удалить" aria-label={`Удалить ${s.name}`} onClick={() => onDelete(s)}>
              <TrashIcon size={20} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
