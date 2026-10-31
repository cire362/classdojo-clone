import { Link } from 'react-router-dom';
import { CheckIcon } from '@phosphor-icons/react';
import type { AttendanceFlow } from '../hooks/useAttendance';
import { dayLabel } from '../labels';

export function AttendanceSaved({ flow }: { flow: AttendanceFlow }) {
  const { data, isToday, multi, date, lessonLabel, saved, setPhase } = flow;
  return (
    <div className="anim-rise-in max-w-xl space-y-4">
      <span className="flex size-14 items-center justify-center rounded-full bg-plus-bg text-plus">
        <CheckIcon size={30} weight="bold" />
      </span>
      <h2 className="text-2xl">
        Посещаемость {isToday && !multi ? 'сохранена' : `за ${dayLabel(date)}${lessonLabel} сохранена`}
      </h2>
      <p className="text-ink-soft">
        Присутствуют {saved} из {data.students.length}. Каждый получил +1 за посещение
        {isToday ? '' : ' с датой урока'}. Фото удалено.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to={`/g/${data.group.id}`} className="btn btn-primary">
          К уроку
        </Link>
        <button className="btn btn-secondary" onClick={() => setPhase('start')}>
          Отметить заново
        </button>
      </div>
    </div>
  );
}
