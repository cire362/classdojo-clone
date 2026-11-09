import { useId, useState } from 'react';
import { NotebookIcon } from '@phosphor-icons/react';
import type { GroupWork, GroupWorks as Works } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useGroup } from '../../groups';
import { decideWork, deleteWork, fetchGroupWorks } from '../api';
import { WorkCard } from './WorkCard';
import { useTerms } from '../../auth';
import { cap } from '@heroes/shared/terms';

const student = (w: GroupWork) => <p className="text-sm font-semibold text-ink-soft">{w.student.name}</p>;

/**
 * Проверка работ группы: опубликовать для родителей или вернуть с комментарием. Решение можно поменять,
 * а работу с неподходящим содержимым — удалить вместе с файлами.
 */
export function GroupWorks() {
  const t = useTerms();
  const id = useId();
  const toast = useToast();
  const { data: group, setData: setGroup } = useGroup();
  const groupId = group.group.id;
  const { data, setData, error, reload } = useLoad(() => fetchGroupWorks(groupId), [groupId]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(request: () => Promise<Works>, done: string) {
    setBusy(true);
    try {
      const works = await request();
      setData(works);
      // Значок на вкладке группы: сколько работ ещё ждёт
      setGroup((current) => current && { ...current, pendingWorks: works.pending.filter((w) => w.mine).length });
      toast({ text: done, tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  const decide = (w: GroupWork, status: 'APPROVED' | 'RETURNED') =>
    act(
      () => decideWork(groupId, w.id, status, (comments[w.id] ?? w.comment).trim()),
      status === 'APPROVED' ? 'Работа опубликована: её видят родители' : `Работа возвращена ${t.student.one.dat}`,
    );

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-48 max-w-2xl" />;
  const mine = data.pending.filter((w) => w.mine);
  const others = data.pending.filter((w) => !w.mine);
  const pendingCard = (w: GroupWork) => (
    <WorkCard key={w.id} work={w} heading={student(w)} showStatus={false}>
      <label className="label" htmlFor={`${id}-${w.id}`}>Комментарий {t.student.one.dat}</label>
      <textarea
        id={`${id}-${w.id}`}
        className="input min-h-16 resize-y"
        maxLength={500}
        placeholder="Похвала или что доделать"
        value={comments[w.id] ?? ''}
        onChange={(e) => setComments({ ...comments, [w.id]: e.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(w, 'APPROVED')}>Опубликовать</button>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide(w, 'RETURNED')}>
          Вернуть на доработку
        </button>
      </div>
    </WorkCard>
  );
  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3" aria-labelledby={`${id}-pending`}>
        <h2 id={`${id}-pending`} className="text-lg">На проверке: {mine.length}</h2>
        {mine.length === 0 && (
          <EmptyState icon={<NotebookIcon size={28} />} title="Новых работ нет">
            {cap(t.student.many.nom)} сдают работы в своём кабинете, во вкладке «Мои работы», и выбирают, кому из
            преподавателей их отправить. До публикации работу видят только преподаватели группы и сам {t.student.one.nom}.
          </EmptyState>
        )}
        <ul className="space-y-3">{mine.map(pendingCard)}</ul>
      </section>
      {others.length > 0 && (
        <section className="space-y-3" aria-labelledby={`${id}-others`}>
          <h2 id={`${id}-others`} className="text-lg">У других преподавателей: {others.length}</h2>
          <p className="text-sm text-ink-soft">Эти работы отправлены коллегам. Проверить их можно, если коллега попросил.</p>
          <ul className="space-y-3">{others.map(pendingCard)}</ul>
        </section>
      )}
      {data.decided.length > 0 && (
        <section className="space-y-3" aria-labelledby={`${id}-decided`}>
          <h2 id={`${id}-decided`} className="text-lg">Проверенные</h2>
          <ul className="space-y-3">
            {data.decided.map((w) => (
              <WorkCard key={w.id} work={{ ...w, unseen: false }} heading={student(w)}>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => decide(w, w.status === 'APPROVED' ? 'RETURNED' : 'APPROVED')}
                  >
                    {w.status === 'APPROVED' ? 'Снять с публикации' : 'Опубликовать'}
                  </button>
                  {deleting === w.id ? (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => act(() => deleteWork(w.id), 'Работа удалена вместе с файлами')}
                    >
                      Точно удалить
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleting(w.id)}>Удалить</button>
                  )}
                </div>
              </WorkCard>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
