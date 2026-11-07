import type { LessonStudent } from '../../../lib/api';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { deleteStudent } from '../api';
import { useTerms } from '../../auth';

export function DeleteStudentModal({ student, onClose, onDeleted }: {
  student: LessonStudent | null;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const t = useTerms();
  const toast = useToast();
  return (
    <Modal open={!!student} title={`Удалить ${t.student.one.acc}?`} onClose={onClose}>
      {student && (
        <div className="space-y-5">
          <p>
            <b>{student.name}</b> будет удалён вместе с героем, баллами и посещаемостью. Это нельзя отменить.
          </p>
          <div className="flex gap-2">
            <button
              className="btn btn-danger"
              onClick={async () => {
                try {
                  await deleteStudent(student.id);
                  onClose();
                  await onDeleted();
                } catch (e) {
                  toast({ text: (e as Error).message, tone: 'error' });
                }
              }}
            >
              Удалить
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
