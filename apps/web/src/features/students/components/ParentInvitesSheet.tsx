import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, PrinterIcon } from '@phosphor-icons/react';
import { QrImage } from '../../codes';
import type { ParentInvite } from '../../../lib/api';
import { formatInviteCode, inviteLink } from '../invite-link';
import { useTerms } from '../../auth';

/** Лист для родительского собрания. Коды показываются один раз, поэтому без списка из выдачи он не открывается */
export function ParentInvitesSheet({ invites }: { invites: ParentInvite[] }) {
  const t = useTerms();
  const { groupId } = useParams();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="no-print mb-6 space-y-4">
        <Link to={`/g/${groupId}/students`} className="btn btn-ghost btn-sm -ml-3">
          <ArrowLeftIcon size={18} /> К {t.student.many.dat}
        </Link>
        <h1 className="text-2xl sm:text-3xl">Приглашения для родителей</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <PrinterIcon size={20} /> Печать
          </button>
          <span className="text-sm text-ink-soft">После ухода с этой страницы коды больше не будут видны.</span>
        </div>
      </div>
      {invites.length === 0 && <p className="text-ink-soft">У всех {t.student.many.gen} группы уже есть вход для родителей.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="print-card flex items-center gap-4 rounded-2xl border border-dashed border-line bg-surface p-4"
          >
            <QrImage
              value={inviteLink(invite.code)}
              label={`QR-код приглашения: ${invite.studentName}`}
              className="w-32 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <div className="text-sm text-ink-soft">Родителям {t.student.one.gen}</div>
              <div className="break-words font-display text-lg">{invite.studentName}</div>
              <p className="mt-1 text-sm">
                Наведите камеру на код или откройте {window.location.host}/invite и введите:{' '}
                <span className="whitespace-nowrap font-mono font-semibold">{formatInviteCode(invite.code)}</span>
              </p>
              <p className="mt-1 text-sm text-ink-soft">Действует до {new Date(invite.expiresAt).toLocaleDateString('ru-RU')}.</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
