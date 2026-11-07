import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowsLeftRightIcon, ChatsCircleIcon, KeyIcon, PaintBrushIcon } from '@phosphor-icons/react';
import type { Credentials, HistoryEvent } from '../../../lib/api';
import { IssueCardsButton } from '../../codes';
import { HeroEditor } from '../../hero';
import { MoveStudentModal } from './MoveStudentModal';
import { ParentAccessCard } from './ParentAccess';
import { ProfileView } from '../../profile';
import { StudentReport } from '../../profile';
import { useToast } from '../../../ui/Toast';
import { ErrorBox, Modal, Skeleton } from '../../../ui';
import { formatDateTime, useLoad } from '../../../lib/hooks';
import { ProfileSkeleton } from '../../profile';
import { CredentialsTable } from './CredentialsTable';
import { addPortfolioItem, deletePointEvent, deletePortfolioItem, fetchStudentProfile, resetStudentPassword, saveStudentHero } from '../api';
import { useTerms } from '../../auth';

export function StudentProfileView() {
  const t = useTerms();
  const { studentId } = useParams();
  const toast = useToast();
  const [issued, setIssued] = useState<Credentials | null>(null);
  const [toDelete, setToDelete] = useState<HistoryEvent | null>(null);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data, setData, error, reload } = useLoad(() => fetchStudentProfile(studentId!), [studentId]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <ProfileSkeleton />;
  const portfolioEdit = {
    add: async (item: { title: string; description: string; emoji: string }) => {
      const portfolio = await addPortfolioItem(data.student.id, item);
      setData({ ...data, portfolio });
      toast({ text: 'Достижение записано в портфолио', tone: 'ok' });
    },
    remove: async (id: string) => {
      const portfolio = await deletePortfolioItem(id);
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
                  setIssued(await resetStudentPassword(data.student.id));
                } catch (e) {
                  toast({ text: (e as Error).message, tone: 'error' });
                }
              }}
            >
              <KeyIcon size={20} /> Новый пароль
            </button>
            {!data.student.group.archivedAt && (
              <IssueCardsButton groupId={data.student.group.id} studentId={data.student.id} className="btn btn-secondary" />
            )}
            <button className="btn btn-secondary" onClick={() => setMoving(true)}>
              <ArrowsLeftRightIcon size={20} /> Перевести
            </button>
          </>
        }
      />
      {t.kind !== 'SCHOOL' && (
        <Link to={`/messages/${data.student.id}/student`} className="btn btn-secondary">
          <ChatsCircleIcon size={20} aria-hidden /> Написать {t.student.one.dat}
        </Link>
      )}
      <ParentAccessCard
        student={data.student}
        groupId={data.student.group.id}
        archived={!!data.student.group.archivedAt || !data.student.group.parentsEnabled}
      />
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
              Запись исчезнет из истории {t.student.one.gen} и статистики, баллы пересчитаются.
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deletePointEvent(toDelete.id);
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

export function StudentHeroEditor() {
  const t = useTerms();
  const { studentId } = useParams();
  const { data, setData, error, reload } = useLoad(() => fetchStudentProfile(studentId!), [studentId]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-[520px]" />;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to={`/s/${data.student.id}`} className="btn btn-ghost btn-sm -ml-3">
          <ArrowLeftIcon size={18} /> {data.student.name}
        </Link>
        <h1 className="text-2xl sm:text-3xl">Герой {t.student.one.gen}</h1>
        <p className="text-ink-soft">Доступны детали до {data.level.level} уровня, как и у самого {t.student.one.gen}.</p>
      </div>
      <HeroEditor
        key={data.student.id}
        initial={data.hero}
        level={data.level.level}
        premium={data.premium}
        ownerLabel={data.student.name}
        onSave={async (name, parts) => {
          const hero = await saveStudentHero(data.student.id, name, parts);
          setData({ ...data, hero });
        }}
      />
    </div>
  );
}
