import { useNavigate } from 'react-router-dom';
import { CopySimpleIcon, PrinterIcon } from '@phosphor-icons/react';
import { QrImage } from '../../codes';
import type { ParentInvite } from '../../../lib/api';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { formatInviteCode, inviteLink } from '../invite-link';

/** Код показывается один раз: в базе хранится только его хеш */
export function InviteModal({ invite, groupId, onClose }: { invite: ParentInvite | null; groupId: string; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast({ text: 'Ссылка скопирована', tone: 'ok' });
    } catch {
      toast({ text: 'Не удалось скопировать. Выделите ссылку вручную', tone: 'error' });
    }
  }

  return (
    <Modal open={!!invite} title="Приглашение для родителей" onClose={onClose}>
      {invite && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Отправьте ссылку родителям {invite.studentName} или распечатайте лист. Родитель сам задаст пароль.
            Приглашение одноразовое, работает до {new Date(invite.expiresAt).toLocaleDateString('ru-RU')} и показывается только сейчас.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <QrImage value={inviteLink(invite.code)} label={`QR-код приглашения: ${invite.studentName}`} className="w-36 rounded-lg" />
            <div className="min-w-0">
              <p className="text-sm text-ink-soft">Код</p>
              <p className="font-mono text-xl font-semibold">{formatInviteCode(invite.code)}</p>
            </div>
          </div>
          <p className="break-all rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">{inviteLink(invite.code)}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => copy(inviteLink(invite.code))}>
              <CopySimpleIcon size={20} aria-hidden /> Скопировать ссылку
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/g/${groupId}/print`, { state: { invites: [invite] } })}>
              <PrinterIcon size={20} aria-hidden /> Распечатать
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
