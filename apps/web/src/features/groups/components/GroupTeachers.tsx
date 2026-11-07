import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignOutIcon, XIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import { Skeleton } from '../../../ui';
import { addGroupTeacher, fetchGroupTeachers, removeGroupTeacher } from '../api';
import { useTerms } from '../../auth';

/**
 * Преподаватели группы. Создатель добавляет коллег по логину и убирает их;
 * соавтор ведёт уроки наравне с создателем и может сам выйти из группы.
 */
export function GroupTeachersSection({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const t = useTerms();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, setData, error } = useLoad(() => fetchGroupTeachers(groupId), [groupId]);
  const [login, setLogin] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setData(await addGroupTeacher(groupId, login.trim()));
      setLogin('');
      toast({ text: 'Коллега добавлен в группу', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(teacherId: string, self: boolean) {
    setBusy(true);
    try {
      await removeGroupTeacher(groupId, teacherId);
      if (self) {
        navigate('/');
        return;
      }
      setData((d) => d && { ...d, coTeachers: d.coTeachers.filter((t) => t.id !== teacherId) });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base">Преподаватели</h3>
      {error && <p className="text-sm text-minus">{error}</p>}
      {!data && !error && <Skeleton className="h-16" />}
      {data && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          <li className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {data.owner.name}
                {data.owner.isMe && <span className="text-ink-soft"> (вы)</span>}
              </span>
              <span className="block text-sm text-ink-soft">создатель группы</span>
            </span>
          </li>
          {data.coTeachers.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {t.name}
                  {t.isMe && <span className="text-ink-soft"> (вы)</span>}
                </span>
                <span className="block font-mono text-sm text-ink-soft">{t.login}</span>
              </span>
              {isOwner && (
                <button className="icon-btn" title="Убрать из группы" aria-label={`Убрать ${t.name} из группы`} disabled={busy} onClick={() => remove(t.id, false)}>
                  <XIcon size={20} />
                </button>
              )}
              {t.isMe && (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => remove(t.id, true)}>
                  <SignOutIcon size={18} /> Выйти из группы
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner ? (
        <form className="space-y-2" onSubmit={add}>
          <label className="label" htmlFor="co-teacher-login">
            Добавить коллегу по логину
          </label>
          <div className="flex gap-2">
            <input
              id="co-teacher-login"
              className="input font-mono"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
            <button className="btn btn-primary shrink-0" disabled={busy || !login.trim()}>
              Добавить
            </button>
          </div>
          <p className="text-sm text-ink-soft">
            Коллега сможет вести уроки, отмечать посещаемость, добавлять {t.student.many.acc} и выдавать входы родителям.
            Удалять и архивировать
            группу можете только вы.
          </p>
        </form>
      ) : (
        <p className="text-sm text-ink-soft">Название, архив, удаление и состав преподавателей меняет создатель группы.</p>
      )}
    </div>
  );
}
