import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChatCircleIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
  LinkSimpleIcon,
  PrinterIcon,
  UserPlusIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { ParentAccess as Access, ParentCredentials, ParentInvite } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { CredentialsTable } from './CredentialsTable';
import { InviteModal } from './InviteModal';
import { useToast } from '../../../ui/Toast';
import { Modal, Skeleton } from '../../../ui';
import { createInvite, fetchInvites, fetchStudentParents, issueParent, linkParent, resetParentPassword, revokeInvite, unlinkParent } from '../api';

/** Входы родителей в карточке ученика: выдать, привязать общий вход брата или сестры, сбросить пароль, отвязать */
export function ParentAccessCard({ student, groupId, archived }: { student: { id: string; name: string }; groupId: string; archived: boolean }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { data, setData, error, reload } = useLoad(() => fetchStudentParents(student.id), [student.id]);
  const [issued, setIssued] = useState<ParentCredentials | null>(null);
  const [linking, setLinking] = useState(false);
  const [login, setLogin] = useState('');
  const [unlinking, setUnlinking] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<ParentInvite | null>(null);
  const invites = useLoad(() => fetchInvites(student.id), [student.id]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const issue = () =>
    run(async () => {
      setIssued(await issueParent(student.id));
      await reload();
    });

  const sendInvite = () =>
    run(async () => {
      setInvite(await createInvite(student.id));
      await invites.reload();
    });

  const cancelInvite = (id: string) =>
    run(async () => {
      await revokeInvite(student.id, id);
      await invites.reload();
      toast({ text: 'Приглашение отозвано', tone: 'neutral' });
    });

  const resetPassword = (p: Access) =>
    run(async () => setIssued(await resetParentPassword(student.id, p.id)));

  async function link(e: FormEvent) {
    e.preventDefault();
    const list = await run(() => linkParent(student.id, login.trim()));
    if (!list) return;
    setData(list);
    setLinking(false);
    setLogin('');
    toast({ text: 'Вход привязан', tone: 'ok' });
  }

  async function unlink(p: Access) {
    const list = await run(() => unlinkParent(student.id, p.id));
    if (!list) return;
    setData(list);
    setUnlinking(null);
    toast({ text: 'Родитель отвязан', tone: 'neutral' });
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby="parents-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="parents-title" className="text-lg">
          Родители
        </h2>
        {!archived && (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={sendInvite}>
              <EnvelopeSimpleIcon size={18} aria-hidden /> Пригласить
            </button>
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={issue}>
              <UserPlusIcon size={18} /> Выдать вход
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setLinking(true)}>
              <LinkSimpleIcon size={18} /> Общий вход с братом или сестрой
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-minus">{error}</p>}
      {!data && !error && <Skeleton className="h-12" />}
      {data?.length === 0 && (
        <p className="text-sm text-ink-soft">Вход для родителей ещё не выдан. С ним родители видят героя, баллы, историю и посещаемость ребёнка.</p>
      )}
      {data && data.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-mono font-semibold">{p.login}</span>
                {p.otherChildren.length > 0 && (
                  <span className="block text-sm text-ink-soft">Также: {p.otherChildren.map((c) => c.name).join(', ')}</span>
                )}
              </span>
              <Link className="icon-btn" title="Написать" aria-label={`Написать ${p.login}`} to={`/messages/${student.id}/${p.id}`}>
                <ChatCircleIcon size={20} />
              </Link>
              <button className="icon-btn" title="Новый пароль" aria-label={`Новый пароль для ${p.login}`} disabled={busy} onClick={() => resetPassword(p)}>
                <KeyIcon size={20} />
              </button>
              <button className="icon-btn" title="Отвязать" aria-label={`Отвязать ${p.login}`} onClick={() => setUnlinking(p)}>
                <XIcon size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!!invites.data?.length && (
        <ul aria-label="Действующие приглашения" className="divide-y divide-line rounded-xl border border-dashed border-line">
          {invites.data.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>Приглашение ждёт родителя, до {new Date(item.expiresAt).toLocaleDateString('ru-RU')}</span>
              <button
                className="icon-btn"
                title="Отозвать"
                aria-label="Отозвать приглашение"
                disabled={busy}
                onClick={() => cancelInvite(item.id)}
              >
                <XIcon size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <InviteModal
        invite={invite}
        groupId={groupId}
        onClose={() => {
          setInvite(null);
          void reload();
        }}
      />

      <Modal open={!!issued} title="Вход для родителей" onClose={() => setIssued(null)}>
        {issued && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">Пароль показывается один раз. Передайте его родителям или распечатайте.</p>
            <CredentialsTable rows={[{ id: issued.parentId, name: `Родители: ${issued.studentName}`, login: issued.login, password: issued.password }]} />
            <button className="btn btn-primary" onClick={() => navigate(`/g/${groupId}/print`, { state: { parents: [issued] } })}>
              <PrinterIcon size={20} /> Распечатать
            </button>
          </div>
        )}
      </Modal>

      <Modal open={linking} title="Общий вход с братом или сестрой" onClose={() => setLinking(false)}>
        <form className="space-y-4" onSubmit={link}>
          <p className="text-sm text-ink-soft">
            Если брат или сестра ученика тоже у вас учится и родителям уже выдан вход, введите его логин: с ним родители увидят обоих детей.
          </p>
          <div>
            <label className="label" htmlFor="parent-login">
              Логин родителя
            </label>
            <input
              id="parent-login"
              className="input font-mono"
              placeholder="parent.masha.i"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" disabled={busy || !login.trim()}>
            Привязать
          </button>
        </form>
      </Modal>

      <Modal open={!!unlinking} title="Отвязать родителя?" onClose={() => setUnlinking(null)}>
        {unlinking && (
          <div className="space-y-5">
            <p>
              {unlinking.otherChildren.length
                ? `Вход ${unlinking.login} останется для: ${unlinking.otherChildren.map((c) => c.name).join(', ')}.`
                : `Других детей у этого входа нет, поэтому ${unlinking.login} будет удалён.`}
            </p>
            <div className="flex gap-2">
              <button className="btn btn-danger" disabled={busy} onClick={() => unlink(unlinking)}>
                Отвязать
              </button>
              <button className="btn btn-secondary" onClick={() => setUnlinking(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
