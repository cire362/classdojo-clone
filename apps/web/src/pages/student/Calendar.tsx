import { Calendar } from '../../features/calendar';

/** Календарь класса для ученика */
export function StudentCalendarPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-2xl sm:text-3xl">Календарь</h1>
      <Calendar path="/student/events" />
    </div>
  );
}
