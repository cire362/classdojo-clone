import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IdentificationCardIcon } from '@phosphor-icons/react';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { issueLoginCards } from '../api';
import { useTerms } from '../../auth';

/** Выпуск QR-карточек: новые заменяют старые, поэтому это же и сброс потерянной карточки */
export function IssueCardsButton({ groupId, studentId, className }: { groupId: string; studentId?: string; className: string }) {
  const t = useTerms();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function issue() {
    setBusy(true);
    try {
      const { cards } = await issueLoginCards(groupId, studentId ? [studentId] : undefined);
      navigate(`/g/${groupId}/print`, { state: { cards } });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      setBusy(false);
    }
  }

  return (
    <>
      <button className={className} onClick={() => setConfirm(true)}>
        <IdentificationCardIcon size={18} aria-hidden /> {studentId ? 'QR-карточка' : 'QR-карточки'}
      </button>
      <Modal open={confirm} title={studentId ? 'Выпустить QR-карточку?' : 'Выпустить QR-карточки?'} onClose={() => setConfirm(false)}>
        <div className="space-y-5">
          <p>
            С карточкой {t.student.one.nom} входит без логина и пароля: достаточно навести камеру. Она работает 90 дней.
            {studentId
              ? ' Если карточка уже выдавалась, старая перестанет работать.'
              : ' Выданные раньше карточки всей группы перестанут работать.'}
          </p>
          <p className="text-sm text-ink-soft">Карточка заменяет пароль, поэтому показать её повторно нельзя: распечатайте сразу.</p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={issue}>{busy ? 'Создаём…' : 'Выпустить'}</button>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Отмена</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
