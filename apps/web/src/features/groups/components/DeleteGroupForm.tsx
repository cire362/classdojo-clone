import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTerms } from '../../auth';
import { useToast } from '../../../ui/Toast';
import { deleteGroup } from '../api';

export function DeleteGroupForm({ group }: { group: { id: string; name: string } }) {
  const t = useTerms();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      if (busy || name !== group.name) return;
      setBusy(true);
      try {
        await deleteGroup(group.id);
        navigate('/');
      } catch (err) {
        toast({ text: (err as Error).message, tone: 'error' });
        setBusy(false);
      }
    }}>
      <p>Будут удалены аккаунты {t.student.many.gen}, их баллы и посещаемость. Восстановить {t.group.one.acc} нельзя.</p>
      <label className="block">
        Для подтверждения введите название «{group.name}»
        <input className="input mt-2" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      </label>
      <button className="btn btn-danger" disabled={busy || name !== group.name}>Удалить {t.group.one.acc}</button>
    </form>
  );
}
