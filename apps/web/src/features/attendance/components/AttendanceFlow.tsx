import { useAttendance } from '../hooks/useAttendance';
import { AttendanceReview } from './AttendanceReview';
import { AttendanceSaved } from './AttendanceSaved';
import { AttendanceStart } from './AttendanceStart';

export function AttendanceFlow() {
  const flow = useAttendance();

  if (flow.data.group.archivedAt) {
    return (
      <p className="max-w-xl rounded-2xl bg-surface-2 px-5 py-4 text-ink-soft">
        Группа в архиве, отмечать посещаемость нельзя. Прошлые уроки видны в статистике.
      </p>
    );
  }
  if (flow.phase === 'saved') return <AttendanceSaved flow={flow} />;
  if (flow.phase === 'start' || flow.phase === 'detecting') return <AttendanceStart flow={flow} />;
  return <AttendanceReview flow={flow} />;
}
