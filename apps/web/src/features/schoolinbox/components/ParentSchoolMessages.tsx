import { useEffect } from 'react';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { Thread } from '../../messages';
import { useNotifications } from '../../notifications';
import { fetchParentSchoolThreads, writeToSchool } from '../api';

/** Переписка родителя с администрацией школы: вопросы, справки, заявления. Отвечает любой сотрудник школы */
export function ParentSchoolMessages() {
  const { data, error, reload } = useLoad(() => fetchParentSchoolThreads(), []);
  const { refresh } = useNotifications();
  useEffect(() => {
    if (data) void refresh();
  }, [data, refresh]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl">Письмо в школу</h1>
        <p className="text-ink-soft">Вопрос, справка или заявление для администрации. О ребёнке и уроках пишите преподавателю.</p>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && data.length === 0 && (
        <EmptyState icon={<EnvelopeSimpleIcon size={40} aria-hidden />} title="Школы пока нет">
          Писать можно школе, где учится ваш ребёнок. Если он перешёл в другой класс, попросите преподавателя снова выдать вход.
        </EmptyState>
      )}
      {data?.map((school) => (
        <section key={school.schoolId} className="space-y-2" aria-labelledby={`school-${school.schoolId}`}>
          <h2 id={`school-${school.schoolId}`} className="text-lg">{school.schoolName}</h2>
          <Thread
            messages={school.messages}
            send={(message) => writeToSchool(school.schoolId, message)}
            emptyText="Сообщений пока нет. Ответ придёт сюда, а в шапке появится отметка."
          />
        </section>
      ))}
    </div>
  );
}
