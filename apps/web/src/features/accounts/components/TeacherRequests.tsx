import { useState } from 'react';
import { CheckIcon, CopyIcon, XIcon } from '@phosphor-icons/react';
import type { TeacherRequest } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { approveTeacher, disableJoinCode, fetchTeacherRequests, rejectTeacher, renewJoinCode } from '../api';
import { useTerms } from '../../auth';

const joinLink = (code: string) => `${window.location.origin}/school-join#${code}`;
const shown = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
const sentAt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * Подключение преподавателей по коду школы. Код включает директор или завуч, преподаватель сам создаёт вход,
 * но войти сможет только после подтверждения здесь
 */
export function TeacherRequests({ joinCode, onChange }: {
  joinCode: string | null;
  onChange: (code: string | null, pending: number) => void;
}) {
  const toast = useToast();
  const t = useTerms();
  const { data, error, reload, setData } = useLoad(() => fetchTeacherRequests(), []);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<TeacherRequest | null>(null);

  async function run<T>(action: () => Promise<T>, done: (result: T) => void) {
    setBusy(true);
    try {
      done(await action());
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  const pending = data?.length ?? 0;
  const decided = (text: string) => (list: TeacherRequest[]) => {
    setData(list);
    onChange(joinCode, list.length);
    toast({ text, tone: 'ok' });
  };

  const renew = () => run(renewJoinCode, (r) => onChange(r.joinCode, pending));

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(joinLink(code));
      toast({ text: 'Ссылка скопирована', tone: 'ok' });
    } catch {
      toast({ text: 'Не удалось скопировать. Выделите ссылку вручную', tone: 'error' });
    }
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby="join-title">
      <div className="space-y-1">
        <h2 id="join-title" className="text-lg">Подключение преподавателей</h2>
        <p className="text-sm text-ink-soft">
          Преподаватель вводит код подключения на странице входа и сам создаёт логин и пароль. Войти он сможет после вашей проверки.
        </p>
      </div>
      {joinCode ? (
        <div className="space-y-3">
          <p>
            <span className="block text-sm text-ink-soft">Код подключения к {t.org.one.dat}</span>
            <span className="font-mono text-2xl font-semibold tracking-[0.15em]">{shown(joinCode)}</span>
          </p>
          <p className="break-all text-sm text-ink-soft">{joinLink(joinCode)}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => copy(joinCode)}>
              <CopyIcon size={18} aria-hidden /> Скопировать ссылку
            </button>
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={renew}>
              Новый код
            </button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(disableJoinCode, () => onChange(null, pending))}>
              Выключить
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary" disabled={busy} onClick={renew}>
          Включить код подключения
        </button>
      )}

      <h3 className="font-sans text-base font-semibold tracking-normal">Ждут проверки {data && `(${pending})`}</h3>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-16" />}
      {data && pending === 0 && <p className="text-sm text-ink-soft">Новых заявок нет.</p>}
      {data && pending > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Заявки преподавателей">
          {data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-52">
                <p className="break-words font-semibold">{r.name}</p>
                <p className="break-all font-mono text-sm text-ink-soft">{r.login}</p>
                <p className="text-sm text-ink-soft">Заявка от {sentAt(r.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  aria-label={`Подтвердить: ${r.name}`}
                  onClick={() => run(() => approveTeacher(r.id), decided(`${r.name} может войти`))}
                >
                  <CheckIcon size={18} aria-hidden /> Подтвердить
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  aria-label={`Отклонить: ${r.name}`}
                  onClick={() => setRejecting(r)}
                >
                  <XIcon size={18} aria-hidden /> Отклонить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!rejecting} title="Отклонить заявку?" onClose={() => { if (!busy) setRejecting(null); }}>
        <div className="space-y-4">
          <p>Вход <b>{rejecting?.login}</b> будет удалён. Если это ваш преподаватель, он сможет подать заявку заново.</p>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => rejecting && run(() => rejectTeacher(rejecting.id), (list) => {
              setRejecting(null);
              decided('Заявка отклонена')(list);
            })}
          >
            Отклонить заявку
          </button>
        </div>
      </Modal>
    </section>
  );
}
