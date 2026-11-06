import { MyWorks } from '../../features/works';

/** Работы ученика: сдача и решения преподавателя */
export function StudentWorksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl sm:text-3xl">Мои работы</h1>
      <MyWorks />
    </div>
  );
}
