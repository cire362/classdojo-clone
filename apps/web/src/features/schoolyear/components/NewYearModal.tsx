import { useEffect, useState } from 'react';
import type { SchoolYearPreview } from '../../../lib/api';
import { longDate } from '../../../lib/files';
import { pluralize, useLoad } from '../../../lib/hooks';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useTerms } from '../../auth';
import { fetchSchoolYear, startSchoolYear } from '../api';

/**
 * Переход на новый учебный год: курс (класс) каждой группы растёт на единицу, отмеченные выпускные
 * группы уходят в архив. Перед применением видно, что произойдёт с каждой группой
 */
export function NewYearModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTerms();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => fetchSchoolYear(), []);
  const [graduate, setGraduate] = useState<Set<string>>(() => new Set());
  const [rename, setRename] = useState(true);
  const [confirmAgain, setConfirmAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setGraduate(new Set(data.groups.filter((g) => g.graduate).map((g) => g.id)));
  }, [data]);
  const word = t.course.toLocaleLowerCase('ru');

  function toggle(id: string) {
    setGraduate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply(preview: SchoolYearPreview) {
    setBusy(true);
    try {
      const res = await startSchoolYear({ graduateIds: [...graduate], rename, force: preview.recent && confirmAgain });
      toast({ text: `Переведено: ${res.promoted}, выпущено: ${res.graduated}`, tone: 'ok' });
      onDone();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Новый учебный год" onClose={onClose} size="lg">
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-48" />}
      {data && (
        <div className="space-y-4">
          <p className="text-ink-soft">
            Каждая группа переходит {t.kind === 'SCHOOL' ? 'в следующий класс' : 'на следующий курс'}.
            Отмеченные выпускные группы уходят в архив:
            {' '}{t.student.many.nom} и их история сохраняются.
          </p>
          {data.lastStartedAt && (
            <p className="rounded-xl bg-surface-2 p-3 text-sm">Прошлый переход: {longDate(data.lastStartedAt)}.</p>
          )}
          {data.groups.length === 0 ? (
            <p>Нет групп с указанным курсом. Задайте его в карточках групп.</p>
          ) : (
            <ul
              className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line"
              aria-label="Что произойдёт с группами"
            >
              {data.groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">{g.name}</span>
                    <span className="block text-sm text-ink-soft">
                      {graduate.has(g.id)
                        ? `${word} ${g.course} → выпуск, в архив`
                        : g.course >= data.maxCourse
                          ? `${word} ${g.course}, без изменений`
                          : `${word} ${g.course} → ${g.course + 1}${rename && g.nextName !== g.name ? `, станет «${g.nextName}»` : ''}`}
                    </span>
                  </span>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-5" checked={graduate.has(g.id)} onChange={() => toggle(g.id)} />
                    Выпуск
                  </label>
                </li>
              ))}
            </ul>
          )}
          {data.withoutCourse.length > 0 && (
            <p className="text-sm text-ink-soft">
              Номер не задан, не изменятся: {data.withoutCourse.map((g) => g.name).join(', ')}.
            </p>
          )}
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-5" checked={rename} onChange={(e) => setRename(e.target.checked)} />
            Менять номер в названии группы
          </label>
          {data.recent && (
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-5" checked={confirmAgain} onChange={(e) => setConfirmAgain(e.target.checked)} />
              Да, перевести ещё раз
            </label>
          )}
          <button
            className="btn btn-primary w-full"
            disabled={busy || !data.groups.length || (data.recent && !confirmAgain)}
            onClick={() => apply(data)}
          >
            Перевести {data.groups.length} {pluralize(data.groups.length, 'группу', 'группы', 'групп')}
          </button>
        </div>
      )}
    </Modal>
  );
}
