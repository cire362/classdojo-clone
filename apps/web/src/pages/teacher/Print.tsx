import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeftIcon, KeyIcon, PrinterIcon } from '@phosphor-icons/react';
import { api, type Credentials, type GroupDetails } from '../../api';
import { ErrorBox, Modal, Skeleton } from '../../components/ui';
import { useLoad } from '../../hooks';

export function CredentialsTable({ rows }: { rows: Credentials[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-ink-soft">
          <tr>
            <th className="px-3 py-2 font-semibold">Имя</th>
            <th className="px-3 py-2 font-semibold">Логин</th>
            <th className="px-3 py-2 font-semibold">Пароль</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 font-mono">{r.login}</td>
              <td className="px-3 py-2 font-mono">{r.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Лист для печати: карточки «имя, логин, пароль» под разрезание */
export function PrintPage() {
  const { groupId } = useParams();
  const location = useLocation();
  const passed = (location.state as { credentials?: Credentials[] } | null)?.credentials ?? null;
  const [issued, setIssued] = useState<Credentials[] | null>(passed);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useLoad(() => api<GroupDetails>('GET', `/teacher/groups/${groupId}`), [groupId]);

  const byId = new Map(issued?.map((c) => [c.id, c]));
  const rows =
    data?.students.map((s) => ({ id: s.id, name: s.name, login: s.login, password: byId.get(s.id)?.password ?? null })) ?? [];
  const visible = issued && issued.length < rows.length ? rows.filter((r) => byId.has(r.id)) : rows;
  const site = window.location.origin;

  async function resetAll() {
    setBusy(true);
    try {
      const r = await api<{ credentials: Credentials[] }>('POST', `/teacher/groups/${groupId}/reset-passwords`, {});
      setIssued(r.credentials);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="no-print mb-6 space-y-4">
        <Link to={`/g/${groupId}/students`} className="btn btn-ghost btn-sm -ml-3">
          <ArrowLeftIcon size={18} /> К ученикам
        </Link>
        <h1 className="text-2xl sm:text-3xl">Лист с логинами{data ? `: ${data.group.name}` : ''}</h1>
        {error && <ErrorBox message={error} onRetry={reload} />}
        {issued ? (
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={() => window.print()}>
              <PrinterIcon size={20} /> Печать
            </button>
            <span className="text-sm text-ink-soft">После ухода с этой страницы пароли больше не будут видны.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <p className="flex-1 text-sm">
              Пароли хранятся только в зашифрованном виде, поэтому их нельзя показать повторно. Чтобы распечатать лист с паролями,
              выдайте всем новые.
            </p>
            <button className="btn btn-primary" onClick={() => setConfirm(true)}>
              <KeyIcon size={20} /> Новые пароли всем
            </button>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              Печать без паролей
            </button>
          </div>
        )}
      </div>

      {!data && <Skeleton className="h-64" />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2">
        {visible.map((r) => (
          <div key={r.id} className="print-card rounded-2xl border border-dashed border-line bg-surface p-4">
            <div className="font-display text-lg">{r.name}</div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
              <dt className="text-ink-soft">Сайт</dt>
              <dd className="font-mono">{site}</dd>
              <dt className="text-ink-soft">Логин</dt>
              <dd className="font-mono font-semibold">{r.login}</dd>
              <dt className="text-ink-soft">Пароль</dt>
              <dd className="font-mono font-semibold">{r.password ?? '________________'}</dd>
            </dl>
          </div>
        ))}
      </div>

      <Modal open={confirm} title="Выдать новые пароли?" onClose={() => setConfirm(false)}>
        <div className="space-y-5">
          <p>Старые пароли всех учеников группы перестанут работать, ученики выйдут из аккаунтов на всех устройствах.</p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={resetAll}>
              {busy ? 'Создаём…' : 'Да, выдать новые'}
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>
              Отмена
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
