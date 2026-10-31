import { Feed } from '../../features/feed';

/** Лента класса для ученика: объявления преподавателей его группы */
export function StudentFeedPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl sm:text-3xl">Лента класса</h1>
      <Feed path="/student/feed" />
    </div>
  );
}
