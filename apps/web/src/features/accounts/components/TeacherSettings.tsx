import { useState, type FormEvent } from 'react';
import { UserIcon } from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { QuietHoursCard } from '../../messages';
import { PasswordCard } from './PasswordCard';
import { useToast } from '../../../ui/Toast';
import { renameTeacher } from '../api';

export function TeacherSettings() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      await renameTeacher(name);
      await refresh();
      toast({ text: 'Имя сохранено', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Настройки</h1>
        <p className="mt-2 text-ink-soft">Логин: <span className="font-mono">{user?.login}</span></p>
      </div>

      <form onSubmit={saveName} className="card space-y-4 p-5" noValidate>
        <h2 className="flex items-center gap-2 text-lg">
          <UserIcon size={22} /> Имя
        </h2>
        <div>
          <label className="label" htmlFor="teacher-name">
            Как к вам обращаться
          </label>
          <input id="teacher-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <p className="mt-2 text-sm text-ink-soft">Имя видно в шапке и в приветствии.</p>
        </div>
        <button className="btn btn-primary" disabled={savingName || !name.trim() || name.trim() === user?.name}>
          {savingName ? 'Сохраняем…' : 'Сохранить имя'}
        </button>
      </form>

      <QuietHoursCard />

      <PasswordCard endpoint="/teacher/me/password" />

    </div>
  );
}
