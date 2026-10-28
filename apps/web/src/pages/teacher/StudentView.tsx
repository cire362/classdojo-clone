import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, KeyIcon, PaintBrushIcon } from '@phosphor-icons/react';
import { api, type Credentials, type Hero, type Profile } from '../../api';
import { HeroEditor } from '../../components/HeroEditor';
import { ProfileView } from '../../components/ProfileView';
import { useToast } from '../../components/Toast';
import { ErrorBox, Modal, Skeleton } from '../../components/ui';
import { useLoad } from '../../hooks';
import { ProfileSkeleton } from '../student/Cabinet';
import { CredentialsTable } from './Print';

export function StudentViewPage() {
  const { studentId } = useParams();
  const toast = useToast();
  const [issued, setIssued] = useState<Credentials | null>(null);
  const { data, error, reload } = useLoad(() => api<Profile>('GET', `/teacher/students/${studentId}/profile`), [studentId]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <ProfileSkeleton />;
  return (
    <div className="space-y-4">
      <Link to={`/g/${data.student.group.id}`} className="btn btn-ghost btn-sm -ml-3">
        <ArrowLeftIcon size={18} /> {data.student.group.name}
      </Link>
      <ProfileView
        profile={data}
        isOwn={false}
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
          </>
        }
      />
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
        ownerLabel={data.student.name}
        onSave={async (name, parts) => {
          const hero = await api<Hero>('PUT', `/teacher/students/${data.student.id}/hero`, { name, parts });
          setData({ ...data, hero });
        }}
      />
    </div>
  );
}
