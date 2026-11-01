import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pluralize } from '../../../lib/hooks';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { createGroupInvites, issueGroupParents } from '../api';

/** Входы родителям всей группы: создаём и открываем лист для печати */
export function ParentsIssueModal({ open, groupId, withoutParents, onClose, onIssued }: {
  open: boolean;
  groupId: string;
  withoutParents: number;
  onClose: () => void;
  onIssued: () => Promise<void>;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function run(request: () => Promise<Record<string, unknown>>) {
    setBusy(true);
    try {
      const state = await request();
      await onIssued();
      navigate(`/g/${groupId}/print`, { state });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  const issue = () => run(async () => ({ parents: (await issueGroupParents(groupId)).credentials }));
  const invite = () => run(async () => ({ invites: (await createGroupInvites(groupId)).invites }));

  return (
    <Modal open={open} title="Входы для родителей" onClose={onClose}>
      <div className="space-y-5">
        <p>
          Создадим вход родителям {withoutParents} {pluralize(withoutParents, 'ученика', 'учеников', 'учеников')}, у кого его ещё нет,
          и откроем лист для печати — удобно раздать на родительском собрании.
        </p>
        <p className="text-sm text-ink-soft">
          Родители увидят героя, баллы, историю и посещаемость только своего ребёнка. Пароли показываются один раз.
        </p>
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={invite}>
            {busy ? 'Создаём…' : 'Приглашения с QR-кодом'}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={issue}>
            Создать и распечатать
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </Modal>
  );
}
