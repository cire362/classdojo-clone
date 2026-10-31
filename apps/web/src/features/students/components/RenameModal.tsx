import { useState } from 'react';
import type { LessonStudent } from '../../../lib/api';
import { Modal } from '../../../ui';
import { renameStudent } from '../api';

export function RenameModal({ student, onClose, onSaved }: { student: LessonStudent | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  if (student && last !== student.id) {
    setLast(student.id);
    setName(student.name);
    setError(null);
  }
  return (
    <Modal open={!!student} title="Имя ученика" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await renameStudent(student!.id, name);
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
        </div>
        <p className="text-sm text-ink-soft">Логин не меняется.</p>
        <button className="btn btn-primary" disabled={!name.trim()}>
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
