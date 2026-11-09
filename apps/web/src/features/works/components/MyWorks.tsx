import { NotebookIcon } from '@phosphor-icons/react';
import type { StudentWork } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useNotifications } from '../../notifications';
import { deleteOwnWork, fetchOwnWorks } from '../api';
import { WorkCard } from './WorkCard';
import { WorkForm } from './WorkForm';
import { useTerms } from '../../auth';

/** Работы ученика: форма сдачи и список с решениями преподавателя. Открытый список снимает значок новых решений */
export function MyWorks() {
  const t = useTerms();
  const toast = useToast();
  const { refresh } = useNotifications();
  const { data, setData, error, reload } = useLoad(async () => {
    const works = await fetchOwnWorks();
    void refresh();
    return works;
  }, []);
  const show = (works: StudentWork[]) => setData(works);

  async function remove(work: StudentWork) {
    try {
      show(await deleteOwnWork(work.id));
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <WorkForm onSubmitted={show} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-32" />}
      {data?.length === 0 && (
        <EmptyState icon={<NotebookIcon size={28} />} title="Работ пока нет">
          {t.kind === 'SCHOOL'
            ? 'Отправьте рисунок, доклад или фото поделки: после проверки работа появится в портфолио.'
            : 'Отправьте доклад, проект или отчёт: после проверки работа появится в портфолио.'}
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3" aria-label="Мои работы">
          {data.map((w) => (
            <WorkCard key={w.id} work={w}>
              {w.status !== 'APPROVED' && (
                <button
                  className="btn btn-ghost btn-sm -ml-3"
                  aria-label={`Убрать работу «${w.title}»`}
                  onClick={() => remove(w)}
                >
                  Убрать работу
                </button>
              )}
            </WorkCard>
          ))}
        </ul>
      )}
    </div>
  );
}
