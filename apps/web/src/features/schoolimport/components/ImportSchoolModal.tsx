import { useState } from 'react';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import type { ImportPlan, ImportResult } from '../../../lib/api';
import { pluralize } from '../../../lib/hooks';
import { Modal } from '../../../ui';
import { useTerms } from '../../auth';
import { applySchoolImport, previewSchoolImport } from '../api';

/**
 * Импорт учреждения из Excel или CSV: сначала план (что будет создано), затем применение тем же файлом.
 * Новым преподавателям выдаются входы; пароли учеников выдаёт преподаватель группы
 */
export function ImportSchoolModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTerms();
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T>(action: () => Promise<T>, then: (value: T) => void) {
    setBusy(true);
    setError(null);
    try {
      then(await action());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const newStudents = plan?.groups.reduce((sum, g) => sum + g.newStudents.length, 0) ?? 0;
  return (
    <Modal open title="Импорт из файла" onClose={() => { if (!busy) onClose(); }} size="lg">
      {result ? (
        <div className="space-y-4">
          <p role="status">
            Создано групп: {result.groups}, добавлено {t.student.many.gen}: {result.students},
            {' '}новых преподавателей: {result.teachers.length}.
          </p>
          {result.teachers.length > 0 && (
            <>
              <p className="text-sm text-ink-soft">Передайте входы преподавателям: пароли показываются только сейчас.</p>
              <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Входы преподавателей">
                {result.teachers.map((c) => (
                  <li key={c.id} className="flex flex-wrap gap-x-4 px-3 py-2 text-sm">
                    <b className="min-w-0 flex-1 break-words">{c.name}</b>
                    <span className="font-mono">{c.login}</span>
                    <span className="font-mono">{c.password}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-sm text-ink-soft">
            Пароли {t.student.many.gen} выдаёт преподаватель группы: раздел «{t.student.many.nom}» → печать входов.
          </p>
          <button className="btn btn-primary w-full" onClick={onDone}>Готово</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-ink-soft">
            Одна строка — один {t.student.one.nom}. Столбцы: подразделение, группа, {t.course.toLocaleLowerCase('ru')}, специальность,
            преподаватель, ФИО. Существующие группы дополняются новыми {t.student.many.ins}.
          </p>
          <a className="btn btn-secondary" href="/api/admin/school-import/template.xlsx" download>
            <DownloadSimpleIcon size={20} weight="bold" /> Образец файла
          </a>
          <div>
            <label className="label" htmlFor="school-import-file">Файл Excel или CSV</label>
            <input
              id="school-import-file"
              type="file"
              className="input"
              accept=".xlsx,.csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPlan(null);
              }}
            />
          </div>
          <button
            className="btn btn-secondary"
            disabled={busy || !file}
            onClick={() => file && run(() => previewSchoolImport(file), setPlan)}
          >
            Проверить файл
          </button>
          {error && <p role="alert" className="text-sm font-medium text-minus">{error}</p>}
          {plan && (
            <section className="space-y-3" aria-label="Что будет создано">
              {plan.errors.length > 0 && (
                <ul className="space-y-1 rounded-xl bg-minus-bg p-3 text-sm text-minus" aria-label="Ошибки в файле">
                  {plan.errors.map((e, i) => <li key={i}>{e.line ? `Строка ${e.line}: ` : ''}{e.message}</li>)}
                </ul>
              )}
              <p>
                {plan.groups.length} {pluralize(plan.groups.length, 'группа', 'группы', 'групп')}, новых {t.student.many.gen}: {newStudents}
                {plan.departments.length > 0 && `, новые подразделения: ${plan.departments.join(', ')}`}
                {plan.teachers.length > 0 && `, новые преподаватели: ${plan.teachers.map((x) => x.name).join(', ')}`}.
              </p>
              <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line" aria-label="Группы из файла">
                {plan.groups.map((g) => (
                  <li key={g.name} className="px-3 py-2 text-sm">
                    <b className="break-words">{g.name}</b> {g.exists ? '(уже есть)' : '(новая)'}
                    <span className="block text-ink-soft">
                      {[g.teacher.name, g.course && `${t.course.toLocaleLowerCase('ru')} ${g.course}`, `+${g.newStudents.length}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-primary w-full"
                disabled={busy || plan.errors.length > 0 || !file}
                onClick={() => file && run(() => applySchoolImport(file), setResult)}
              >
                Импортировать
              </button>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
