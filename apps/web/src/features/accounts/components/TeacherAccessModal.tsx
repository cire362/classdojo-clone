import { useState } from 'react';
import type { AdminTeacher } from '../../../lib/api';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useTerms } from '../../auth';
import { deleteTeacher, setTeacherDisabled, transferTeacherGroups } from '../api';

/**
 * Доступ преподавателя: отключить вход, передать свои группы коллеге, удалить учётную запись.
 * Удаление доступно, только когда своих групп не осталось
 */
export function TeacherAccessModal({ teacher, colleagues, onClose, onChanged }: {
  teacher: AdminTeacher;
  colleagues: AdminTeacher[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const t = useTerms();
  const toast = useToast();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const others = colleagues.filter((c) => c.id !== teacher.id && !c.disabled);

  async function run(action: () => Promise<unknown>, text: string, close = false) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      toast({ text, tone: 'ok' });
      if (close) onClose();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Доступ: ${teacher.name}`} onClose={() => { if (!busy) onClose(); }}>
      <div className="space-y-6">
        <section className="space-y-2" aria-labelledby="access-login">
          <h3 id="access-login" className="text-base">Вход</h3>
          <p className="text-sm text-ink-soft">
            {teacher.disabled
              ? 'Вход отключён: преподаватель не может войти, его группы и записи сохранены.'
              : 'Отключённый преподаватель сразу выходит на всех устройствах. Группы и записи остаются.'}
          </p>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => run(
              () => setTeacherDisabled(teacher.id, !teacher.disabled),
              teacher.disabled ? 'Вход включён' : 'Вход отключён',
            )}
          >
            {teacher.disabled ? 'Включить вход' : 'Отключить вход'}
          </button>
        </section>

        <section className="space-y-2" aria-labelledby="access-groups">
          <h3 id="access-groups" className="text-base">Свои группы: {teacher.ownedGroups}</h3>
          {teacher.ownedGroups === 0 ? (
            <p className="text-sm text-ink-soft">Своих групп нет.</p>
          ) : (
            <>
              <p className="text-sm text-ink-soft">
                Группы вместе с {t.student.many.ins}, героями и историей перейдут коллеге: он станет их создателем.
              </p>
              <label className="label" htmlFor="transfer-to">Кому передать</label>
              <select id="transfer-to" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Выберите преподавателя</option>
                {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                className="btn btn-secondary"
                disabled={busy || !target}
                onClick={() => run(() => transferTeacherGroups(teacher.id, target), 'Группы переданы')}
              >
                Передать группы
              </button>
            </>
          )}
        </section>

        <section className="space-y-2" aria-labelledby="access-delete">
          <h3 id="access-delete" className="text-base">Удаление</h3>
          {teacher.ownedGroups > 0 ? (
            <p className="text-sm text-ink-soft">Удалить можно после передачи своих групп.</p>
          ) : (
            <>
              <p className="text-sm text-ink-soft">
                Удалятся вход, соавторство, потоки, записи в лентах и сообщения преподавателя. Достижения в портфолио {t.student.many.gen}
                {' '}останутся. Если записи нужны, лучше отключить вход.
              </p>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="size-5" checked={confirmDelete} onChange={(e) => setConfirmDelete(e.target.checked)} />
                Удалить безвозвратно
              </label>
              <button
                className="btn btn-danger"
                disabled={busy || !confirmDelete}
                onClick={() => run(() => deleteTeacher(teacher.id), 'Преподаватель удалён', true)}
              >
                Удалить преподавателя
              </button>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
