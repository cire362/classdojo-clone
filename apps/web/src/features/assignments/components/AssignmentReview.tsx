import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import type { AssignmentAnswer, AssignmentDetail } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useGroup } from '../../groups';
import { WorkCard } from '../../works';
import { decideAnswer, deleteAssignment, fetchAssignment } from '../api';
import { AssignmentBody, AssignmentMeta } from './AssignmentInfo';
import { useTerms } from '../../auth';

/** Задание и ответы получивших его учеников: принять ответ (с баллами задания) или вернуть с комментарием */
export function AssignmentReview({ assignmentId }: { assignmentId: string }) {
  const t = useTerms();
  const id = useId();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: group, reload: reloadGroup } = useGroup();
  const groupId = group.group.id;
  const archived = !!group.group.archivedAt;
  const { data, setData, error, reload } = useLoad(() => fetchAssignment(groupId, assignmentId), [groupId, assignmentId]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(request: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      const result = await request();
      if (result && !Array.isArray(result)) setData(result as AssignmentDetail);
      void reloadGroup();
      toast({ text: done, tone: 'ok' });
      return true;
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const decide = (answer: AssignmentAnswer, status: 'APPROVED' | 'RETURNED') =>
    act(
      () => decideAnswer(groupId, assignmentId, answer.work!.id, status, (comments[answer.work!.id] ?? answer.work!.comment).trim()),
      status === 'APPROVED' ? `Ответ принят: ${answer.student.name}` : `Ответ возвращён: ${answer.student.name}`,
    );

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-48 max-w-2xl" />;
  return (
    <div className="max-w-2xl space-y-6">
      <Link to=".." relative="path" className="btn btn-ghost btn-sm -ml-3">
        <ArrowLeftIcon size={18} aria-hidden /> Все задания
      </Link>
      <section className="card space-y-2 p-4" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="text-xl">{data.title}</h2>
        <AssignmentMeta assignment={data} />
        <AssignmentBody assignment={data} />
        <p className="text-sm text-ink-soft">
          Сдали {data.pending + data.accepted + data.returned} из {data.assigned}, на проверке {data.pending}, принято {data.accepted}
        </p>
      </section>
      <section className="space-y-3" aria-labelledby={`${id}-answers`}>
        <h2 id={`${id}-answers`} className="text-lg">Ответы</h2>
        <ul className="space-y-3">
          {data.answers.map((answer) =>
            answer.work ? (
              <WorkCard
                key={answer.student.id}
                work={{ ...answer.work, unseen: false }}
                answer
                heading={
                  <p className="text-sm font-semibold text-ink-soft">
                    {answer.student.name}
                    {answer.late && <span className="chip ml-2 bg-minus-bg text-xs text-minus">С опозданием</span>}
                  </p>
                }
              >
                {!archived && (
                  <>
                    <label className="label" htmlFor={`${id}-${answer.work.id}`}>Комментарий {t.student.one.dat}</label>
                    <textarea
                      id={`${id}-${answer.work.id}`}
                      className="input min-h-16 resize-y"
                      maxLength={500}
                      value={comments[answer.work.id] ?? answer.work.comment}
                      onChange={(e) => setComments({ ...comments, [answer.work!.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      {answer.status !== 'APPROVED' && (
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(answer, 'APPROVED')}>
                          Принять
                        </button>
                      )}
                      {answer.status !== 'RETURNED' && (
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide(answer, 'RETURNED')}>
                          Вернуть на доработку
                        </button>
                      )}
                    </div>
                  </>
                )}
              </WorkCard>
            ) : (
              <li
                key={answer.student.id}
                className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3"
              >
                <span className="font-semibold">{answer.student.name}</span>
                <span className="text-sm text-ink-soft">Ответа нет</span>
              </li>
            ),
          )}
        </ul>
      </section>
      {confirmDelete ? (
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={async () => {
            if (await act(() => deleteAssignment(groupId, assignmentId), 'Задание удалено')) navigate('..', { relative: 'path' });
          }}
        >
          Точно удалить задание и ответы
        </button>
      ) : (
        <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>Удалить задание</button>
      )}
    </div>
  );
}
