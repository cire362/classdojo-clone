import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowsLeftRightIcon, KeyIcon, PaintBrushIcon } from '@phosphor-icons/react';
import { api, type Credentials, type Hero, type HistoryEvent, type PortfolioItem, type Profile } from '../../api';
import { HeroEditor } from '../../components/HeroEditor';
import { MoveStudentModal } from '../../components/MoveStudentModal';
import { ParentAccessCard } from '../../components/ParentAccess';
import { ProfileView } from '../../components/ProfileView';
import { StudentReport } from '../../components/StudentReport';
import { useToast } from '../../components/Toast';
import { ErrorBox, Modal, Skeleton } from '../../components/ui';
import { formatDateTime, useLoad } from '../../hooks';
import { ProfileSkeleton } from '../student/Cabinet';
import { CredentialsTable } from './Print';

export function StudentViewPage() {
  const { studentId } = useParams();
  const toast = useToast();
  const [issued, setIssued] = useState<Credentials | null>(null);
  const [toDelete, setToDelete] = useState<HistoryEvent | null>(null);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data, setData, error, reload } = useLoad(() => api<Profile>('GET', `/teacher/students/${studentId}/profile`), [studentId]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <ProfileSkeleton />;
  const portfolioEdit = {
    add: async (item: { title: string; description: string; emoji: string }) => {
      const portfolio = await api<PortfolioItem[]>('POST', `/teacher/students/${data.student.id}/portfolio`, item);
      setData({ ...data, portfolio });
      toast({ text: 'Достижение записано в портфолио', tone: 'ok' });
    },
    remove: async (id: string) => {
      const portfolio = await api<PortfolioItem[]>('DELETE', `/teacher/portfolio/${id}`);
      setData({ ...data, portfolio });
    },
  };
  return (
    <div className="space-y-4">
      <Link to={`/g/${data.student.group.id}`} className="btn btn-ghost btn-sm -ml-3">
        <ArrowLeftIcon size={18} /> {data.student.group.name}
      </Link>
      <StudentReport key={data.student.id} studentId={data.student.id} studentName={data.student.name} />
      <ProfileView
        profile={data}
        isOwn={false}
        onDeleteEvent={data.student.group.archivedAt ? undefined : setToDelete}
        portfolioEdit={portfolioEdit}
        actions={
          <>
            <Link to={`/s/${data.student.id}/hero`} className="btn btn-primary">
              <PaintBrushIcon size={20} weight="bold" /> Собрать героя
            </Link>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  setIssued(await api<Credentials>('POST', `/teacher/students/${data.student.id}/reset-password`));
                } catch (e) {
                  toast({ text: (e as Error).message, tone: 'error' });
                }
              }}
            >
              <KeyIcon size={20} /> Новый пароль
            </button>
            <button className="btn btn-secondary" onClick={() => setMoving(true)}>
              <ArrowsLeftRightIcon size={20} /> Перевести
            </button>
          </>
        }
      />
      <ParentAccessCard student={data.student} groupId={data.student.group.id} archived={!!data.student.group.archivedAt} />
      <MoveStudentModal
        student={moving ? { id: data.student.id, name: data.student.name, groupId: data.student.group.id } : null}
        onClose={() => setMoving(false)}
        onMoved={async (g) => {
          setMoving(false);
          await reload();
          toast({ text: `${data.student.name.split(' ')[0]} теперь в группе ${g.name}`, tone: 'ok' });
        }}
      />
      <Modal open={!!toDelete} title="Удалить запись?" onClose={() => setToDelete(null)}>
        {toDelete && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                {toDelete.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{toDelete.reasonName}</span>
                <span className="block text-sm text-ink-soft">{formatDateTime(toDelete.createdAt)}</span>
              </span>
              <span className={`chip ${toDelete.value > 0 ? 'bg-plus-bg text-plus' : 'bg-minus-bg text-minus'}`}>
                {toDelete.value > 0 ? `+${toDelete.value}` : `−${Math.abs(toDelete.value)}`}
              </span>
            </div>
            <p className="text-sm text-ink-soft">
              Запись исчезнет из истории ученика и статистики, баллы пересчитаются.
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await api('DELETE', `/teacher/points/${toDelete.id}`);
                    setToDelete(null);
                    await reload();
                    toast({ text: 'Запись удалена', tone: 'neutral' });
                  } catch (e) {
                    toast({ text: (e as Error).message, tone: 'error' });
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                Удалить
              </button>
              <button className="btn btn-secondary" onClick={() => setToDelete(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!issued} title="Новый пароль" onClose={() => setIssued(null)}>
        {issued && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">Пароль показывается один раз. Старый больше не работает.</p>
            <CredentialsTable rows={[issued]} />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function StudentHeroPage() {
  const { studentId } = useParams();
  const { data, setData, error, reload } = useLoad(() => api<Profile>('GET', `/teacher/students/${studentId}/profile`), [studentId]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-[520px]" />;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to={`/s/${data.student.id}`} className="btn btn-ghost btn-sm -ml-3">
          <ArrowLeftIcon size={18} /> {data.student.name}
        </Link>
        <h1 className="text-2xl sm:text-3xl">Герой ученика</h1>
        <p className="text-ink-soft">Доступны детали до {data.level.level} уровня, как и у самого ученика.</p>
      </div>
      <HeroEditor
        key={data.student.id}
        initial={data.hero}
        level={data.level.level}
        premium={data.premium}
        ownerLabel={data.student.name}
        onSave={async (name, parts) => {
          const hero = await api<Hero>('PUT', `/teacher/students/${data.student.id}/hero`, { name, parts });
          setData({ ...data, hero });
        }}
      />
    </div>
  );
}
