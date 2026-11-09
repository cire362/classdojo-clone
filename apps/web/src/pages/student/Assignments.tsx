import { StudentAssignments } from '../../features/assignments';

/** Задания ученика и ответы на них */
export function StudentAssignmentsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-2xl sm:text-3xl">Задания</h1>
      <StudentAssignments />
    </div>
  );
}
