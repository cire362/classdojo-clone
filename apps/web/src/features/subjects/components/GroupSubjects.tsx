import { useState, type FormEvent } from 'react';
import { TrashIcon } from '@phosphor-icons/react';
import { cap } from '@heroes/shared/terms';
import type { GroupSubject } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import { useTerms } from '../../auth';
import { createSubject, fetchSchoolTeachers, fetchSubjects, removeGroupSubject, setGroupSubject } from '../api';

const NEW = '__new';

/**
 * Дисциплины группы в её настройках: создатель группы назначает дисциплину и преподавателя.
 * Преподаватель дисциплины становится соавтором группы
 */
export function GroupSubjects({ groupId, subjects, canEdit, onChange }: {
  groupId: string;
  subjects: GroupSubject[];
  canEdit: boolean;
  onChange: () => Promise<void>;
}) {
  const t = useTerms();
  const toast = useToast();
  const catalog = useLoad(() => (canEdit ? fetchSubjects() : Promise.resolve([])), [canEdit]);
  const teachers = useLoad(() => (canEdit ? fetchSchoolTeachers() : Promise.resolve([])), [canEdit]);
  const [form, setForm] = useState({ subjectId: '', name: '', teacherId: '' });
  const [busy, setBusy] = useState(false);
  const title = cap(t.subject.many.nom);
  const subjectList = Array.isArray(catalog.data) ? catalog.data : [];
  const teacherList = Array.isArray(teachers.data) ? teachers.data : [];

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await onChange();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      let subjectId = form.subjectId;
      if (subjectId === NEW) {
        const list = await createSubject(form.name.trim());
        subjectId = list.find((s) => s.name === form.name.trim())!.id;
      }
      await setGroupSubject(groupId, subjectId, form.teacherId);
      setForm({ subjectId: '', name: '', teacherId: '' });
      void catalog.reload();
    });
  }

  const ready = form.teacherId && (form.subjectId === NEW ? form.name.trim() : form.subjectId);
  return (
    <div className="space-y-3">
      <h3 className="text-base">{title}</h3>
      {subjects.length === 0 && <p className="text-sm text-ink-soft">{title} не назначены: баллы и уроки идут без них.</p>}
      {subjects.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line" aria-label={title}>
          {subjects.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">{s.subject.name}</span>
                <span className="block text-sm text-ink-soft">{s.teacher.name}</span>
              </span>
              {canEdit && (
                <button
                  className="icon-btn hover:text-minus"
                  aria-label={`Убрать «${s.subject.name}»`}
                  disabled={busy}
                  onClick={() => run(() => removeGroupSubject(groupId, s.id))}
                >
                  <TrashIcon size={20} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="group-subject">{cap(t.subject.one.nom)}</label>
            <select
              id="group-subject"
              className="input"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              <option value="">Выберите</option>
              {subjectList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={NEW}>Новое название…</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="group-subject-teacher">Преподаватель</label>
            <select
              id="group-subject-teacher"
              className="input"
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            >
              <option value="">Выберите</option>
              {teacherList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" disabled={busy || !ready}>Назначить</button>
          {form.subjectId === NEW && (
            <div className="sm:col-span-3">
              <label className="label" htmlFor="group-subject-name">Название {t.subject.one.gen}</label>
              <input
                id="group-subject-name"
                className="input"
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}
        </form>
      )}
    </div>
  );
}
