import { useNavigate } from 'react-router-dom';
import { PrinterIcon } from '@phosphor-icons/react';
import type { Credentials } from '../../../lib/api';
import { Modal } from '../../../ui';
import { CredentialsTable } from './CredentialsTable';

export function IssuedCredentialsModal({ issued, groupId, onClose }: { issued: Credentials[] | null; groupId: string; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal open={!!issued} title="Логины и пароли" onClose={onClose} size="lg">
      {issued && (
        <div className="space-y-4">
          <p className="rounded-xl bg-accent/25 px-4 py-3 text-sm font-medium">
            Пароли показываются только сейчас. Распечатайте или перепишите их. Позже можно выдать новые.
          </p>
          <CredentialsTable rows={issued} />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/g/${groupId}/print`, { state: { credentials: issued } })}
            >
              <PrinterIcon size={20} /> Распечатать
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Готово
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
