import { useEffect } from 'react';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { Thread } from '../../messages';
import { useNotifications } from '../../notifications';
import { fetchReaderThreads, writeToSchool } from '../api';
import { cap } from '@heroes/shared/terms';
import { useOptionalAuth, useTerms } from '../../auth';

/** Переписка родителя с администрацией школы: вопросы, справки, заявления. Отвечает любой сотрудник школы */
export function ParentSchoolMessages() {
  const who = useOptionalAuth()?.user?.role === 'STUDENT' ? 'student' : 'parent';
  const { data, error, reload } = useLoad(() => fetchReaderThreads(who), [who]);
  const { refresh } = useNotifications();
  const t = useTerms();
  useEffect(() => {
    if (data) void refresh();
  }, [data, refresh]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl">Письмо в {t.org.one.acc}</h1>
        <p className="text-ink-soft">
          Вопрос, справка или заявление для администрации.{who === 'parent' && ' О ребёнке и уроках пишите преподавателю.'}
        </p>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && data.length === 0 && (
        <EmptyState icon={<EnvelopeSimpleIcon size={40} aria-hidden />} title={`${cap(t.org.one.gen)} пока нет`}>
          {who === 'parent'
            ? `Писать можно в ${t.org.one.acc}, где учится ваш ребёнок. `
              + 'Если он перешёл в другую группу, попросите преподавателя снова выдать вход.'
            : `Писать можно, пока ваша группа действует. Если вас перевели, обратитесь к преподавателю.`}
        </EmptyState>
      )}
      {data?.map((school) => (
        <section key={school.schoolId} className="space-y-2" aria-labelledby={`school-${school.schoolId}`}>
          <h2 id={`school-${school.schoolId}`} className="text-lg">{school.schoolName}</h2>
          <Thread
            messages={school.messages}
            send={(message) => writeToSchool(who, school.schoolId, message)}
            emptyText="Сообщений пока нет. Ответ придёт сюда, а в шапке появится отметка."
          />
        </section>
      ))}
    </div>
  );
}
