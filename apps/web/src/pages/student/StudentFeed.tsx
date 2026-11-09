import { Feed } from '../../features/feed';
import { useTerms } from '../../features/auth';

/** Лента группы для ученика: объявления преподавателей его группы */
export function StudentFeedPage() {
  const t = useTerms();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-2xl sm:text-3xl">Лента {t.group.one.gen}</h1>
      <Feed path="/student/feed" />
    </div>
  );
}
