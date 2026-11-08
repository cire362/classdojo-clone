import { cap } from '@heroes/shared/terms';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useTerms } from '../../auth';
import { fetchSubjectSummary } from '../api';

const percent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Сводка группы по дисциплинам за выбранный период: уроки, посещаемость, плюсы и минусы */
export function SubjectSummaryTable({ groupId, from, to }: { groupId: string; from: string; to: string }) {
  const t = useTerms();
  const { data, error, reload } = useLoad(() => fetchSubjectSummary(groupId, from, to), [groupId, from, to]);
  const title = `По ${t.subject.many.dat}`;
  return (
    <section className="space-y-3" aria-labelledby="subject-summary-title">
      <h2 id="subject-summary-title" className="text-lg">{title}</h2>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-32" />}
      {data && (
        // Узкий экран прокручивает таблицу: область доступна с клавиатуры
        <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label={`Таблица: ${title.toLowerCase()}`}>
          <table className="w-full min-w-[480px] text-left text-[15px]">
            <thead className="border-b border-line text-sm text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">{cap(t.subject.one.nom)}</th>
                <th className="px-4 py-3 text-right font-semibold">Уроков</th>
                <th className="px-4 py-3 text-right font-semibold">Посещаемость</th>
                <th className="px-4 py-3 text-right font-semibold">Плюсы</th>
                <th className="px-4 py-3 text-right font-semibold">Минусы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((r) => (
                <tr key={r.subject?.id ?? 'none'}>
                  <td className="px-4 py-3">{r.subject?.name ?? <span className="text-ink-soft">Без {t.subject.one.gen}</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.lessons}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{percent(r.attendance)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-plus">+{r.earned}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-minus">−{r.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
