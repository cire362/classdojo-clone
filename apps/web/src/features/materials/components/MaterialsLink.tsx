import { Link } from 'react-router-dom';
import { BooksIcon } from '@phosphor-icons/react';

/** Вход в методички с главной преподавателя */
export function MaterialsLink() {
  return (
    <Link to="/materials" className="card flex items-center gap-4 p-5 transition hover:shadow-[var(--shadow-pop)]">
      <BooksIcon size={32} className="shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block font-display text-xl">Методички</span>
        <span className="block text-sm text-ink-soft">Свои материалы к урокам и материалы коллег: Word, PDF, презентации</span>
      </span>
    </Link>
  );
}
