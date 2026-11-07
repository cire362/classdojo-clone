import type { TeacherCredentials } from '../../../lib/api';
import { Modal } from '../../../ui';

/** Новый вход или пароль: показывается один раз, повторно его не узнать */
export function IssuedCredentials({ issued, title, onClose }: { issued: TeacherCredentials | null; title: string; onClose: () => void }) {
  return (
    <Modal open={!!issued} title={title} onClose={onClose}>
      {issued && (
        <div className="space-y-4">
          <p className="font-semibold">{issued.name}</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl bg-surface-2 p-4">
            <dt>Логин</dt>
            <dd className="break-all font-mono font-semibold">{issued.login}</dd>
            <dt>Пароль</dt>
            <dd className="break-all font-mono font-semibold">{issued.password}</dd>
          </dl>
          <p className="text-sm text-ink-soft">Пароль показывается только сейчас. Сохраните его перед закрытием окна.</p>
          <button className="btn btn-primary" onClick={onClose}>Данные сохранены, закрыть</button>
        </div>
      )}
    </Modal>
  );
}
