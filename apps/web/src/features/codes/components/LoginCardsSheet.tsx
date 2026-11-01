import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, PrinterIcon } from '@phosphor-icons/react';
import type { LoginCard } from '../../../lib/api';
import { QrImage } from './QrImage';

/** Токены показываются только сразу после выпуска, поэтому лист строится из переданного списка */
export function LoginCardsSheet({ cards }: { cards: LoginCard[] }) {
  const { groupId } = useParams();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="no-print mb-6 space-y-4">
        <Link to={`/g/${groupId}/students`} className="btn btn-ghost btn-sm -ml-3">
          <ArrowLeftIcon size={18} /> К ученикам
        </Link>
        <h1 className="text-2xl sm:text-3xl">QR-карточки для входа</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <PrinterIcon size={20} /> Печать
          </button>
          <span className="text-sm text-ink-soft">После ухода с этой страницы карточки больше не будут видны.</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.studentId}
            className="print-card flex items-center gap-4 rounded-2xl border border-dashed border-line bg-surface p-4"
          >
            <QrImage
              value={`${window.location.origin}/q#${card.token}`}
              label={`QR-код для входа: ${card.name}`}
              className="w-32 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <div className="break-words font-display text-lg">{card.name}</div>
              <p className="mt-1 text-sm">Наведи камеру на код и открой ссылку.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Не показывай карточку другим. Действует до {new Date(card.expiresAt).toLocaleDateString('ru-RU')}.
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
