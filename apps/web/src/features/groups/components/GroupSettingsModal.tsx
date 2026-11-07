import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArchiveIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { exportUrl } from '../../../lib/files';
import { pluralize } from '../../../lib/hooks';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { useGroup } from '../hooks/useGroup';
import { GroupTeachersSection } from './GroupTeachers';
import { archiveGroup, deleteGroup, renameGroup } from '../api';
import { useTerms } from '../../auth';
import { cap } from '@heroes/shared/terms';

export function GroupSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTerms();
  const { data, reload } = useGroup();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(data.group.name);
  const [confirmDelete, setConfirmDelete] = useState('');
  return (
    <Modal open={open} title="Настройки группы" onClose={onClose}>
      <div className="space-y-8">
        <GroupTeachersSection groupId={data.group.id} isOwner={data.group.isOwner} />
        <div className="space-y-3">
          <h3 className="text-base">Фото и файлы</h3>
          <p className="text-sm text-ink-soft">
            Фото и видео ленты, вложения переписки с родителями и файлы {t.student.many.gen} одним архивом ZIP, по папкам.
          </p>
          <a className="btn btn-secondary" href={exportUrl(`/teacher/groups/${data.group.id}`)} download>
            <DownloadSimpleIcon size={20} aria-hidden /> Скачать архив
          </a>
        </div>
        {data.group.isOwner && (
          <>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await renameGroup(data.group.id, name);
                  await reload();
                  onClose();
                } catch (err) {
                  toast({ text: (err as Error).message, tone: 'error' });
                }
              }}
            >
              <label className="label" htmlFor="group-rename">
                Название
              </label>
              <input id="group-rename" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <button className="btn btn-primary" disabled={!name.trim() || name === data.group.name}>
                Переименовать
              </button>
            </form>
            {!data.group.archivedAt && (
              <div className="space-y-3 rounded-2xl border border-line p-4">
                <h3 className="text-base">Архив</h3>
                <p className="text-sm text-ink-soft">
                  Для групп, которые закончили занятия. Группа уйдёт из списка на главной, баллы и посещаемость заморозятся, а
                  статистика, профили и Excel останутся. {cap(t.student.many.nom)} по-прежнему смогут входить.
                  Вернуть группу можно в любой момент.
                </p>
                <p className="text-sm text-ink-soft">
                  Фото и файлы архивной группы хранятся {data.group.filesKeptDays}{' '}
                  {pluralize(data.group.filesKeptDays, 'день', 'дня', 'дней')}, потом удаляются. Баллы и статистика остаются.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    await archiveGroup(data.group.id);
                    navigate('/');
                  }}
                >
                  <ArchiveIcon size={20} /> Перенести в архив
                </button>
              </div>
            )}
            <div className="space-y-3 rounded-2xl border border-minus/30 p-4">
              <h3 className="text-base text-minus">Удаление группы</h3>
              <p className="text-sm text-ink-soft">
                Удалятся все {t.student.many.nom} группы, их аккаунты, баллы и посещаемость. Введите название группы, чтобы подтвердить.
              </p>
              <input className="input" aria-label="Название группы для подтверждения" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} />
              <button
                className="btn btn-danger"
                disabled={confirmDelete !== data.group.name}
                onClick={async () => {
                  await deleteGroup(data.group.id);
                  navigate('/');
                }}
              >
                Удалить группу
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
