import { useState, type FormEvent } from 'react';
import type { AdminGroup } from '../../../lib/api';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useTerms } from '../../auth';
import { updateAdminGroup } from '../api';

/** Подразделение, курс (в школе — параллель) и специальность группы. Список подразделений — уже в пределах прав смотрящего */
export function GroupMetaModal({ group, options, onClose, onSaved }: {
  group: AdminGroup | null;
  options: { id: string; label: string }[];
  onClose: () => void;
  onSaved: (groups: AdminGroup[]) => void;
}) {
  const t = useTerms();
  const toast = useToast();
  const [form, setForm] = useState({ departmentId: '', course: '', specialty: '' });
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (group && openedFor !== group.id) {
    setOpenedFor(group.id);
    setForm({ departmentId: group.department?.id ?? '', course: group.course ? String(group.course) : '', specialty: group.specialty });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    setBusy(true);
    try {
      onSaved(await updateAdminGroup(group.id, {
        departmentId: form.departmentId || null,
        course: form.course ? Number(form.course) : null,
        specialty: form.specialty.trim(),
      }));
      onClose();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const courses = Array.from({ length: t.maxCourse }, (_, i) => i + 1);
  return (
    <Modal open={!!group} title={group ? `Группа ${group.name}` : ''} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={save} className="space-y-4">
        {t.kind !== 'SCHOOL' && (
          <div>
            <label className="label" htmlFor="group-department">Подразделение</label>
            <select
              id="group-department"
              className="input"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">Без подразделения</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="group-course">{t.course}</label>
          <select id="group-course" className="input" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
            <option value="">Не указан</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {t.kind !== 'SCHOOL' && (
          <div>
            <label className="label" htmlFor="group-specialty">Специальность или направление</label>
            <input
              id="group-specialty"
              className="input"
              maxLength={120}
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            />
          </div>
        )}
        <button className="btn btn-primary" disabled={busy}>Сохранить</button>
      </form>
    </Modal>
  );
}
