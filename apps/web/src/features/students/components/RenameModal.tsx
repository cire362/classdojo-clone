import { useState } from 'react';
import type { LessonStudent } from '../../../lib/api';
import { Modal, Toggle } from '../../../ui';
import { updateStudent } from '../api';
import { useTerms } from '../../auth';
import { cap } from '@heroes/shared/terms';

/** Имя ученика и отметка, что его фото нельзя публиковать */
export function RenameModal({ student, onClose, onSaved }: { student: LessonStudent | null; onClose: () => void; onSaved: () => void }) {
  const t = useTerms();
  const [name, setName] = useState('');
  const [noPhotos, setNoPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  if (student && last !== student.id) {
    setLast(student.id);
    setName(student.name);
    setNoPhotos(student.noPhotos);
    setError(null);
  }
  return (
    <Modal open={!!student} title={cap(t.student.one.nom)} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await updateStudent(student!.id, { name, noPhotos });
            onSaved();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div>
          <label className="label" htmlFor="student-name">
            Имя и фамилия
          </label>
          <input id="student-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          {error && <p className="mt-2 text-sm font-medium text-minus">{error}</p>}
          <p className="mt-1 text-sm text-ink-soft">Логин не меняется.</p>
        </div>
        <Toggle
          checked={noPhotos}
          onChange={setNoPhotos}
          label="Не публиковать фото"
          hint="Например, если родители не дали согласие. Напомним об этом, когда вы добавите фото в ленту."
        />
        <button className="btn btn-primary" disabled={!name.trim()}>
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
