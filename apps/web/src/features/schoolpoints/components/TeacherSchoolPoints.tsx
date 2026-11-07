import { useState } from 'react';
import type { RatingPeriod } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { fetchStudentSchoolGoal, fetchTeacherSchoolPoints } from '../api';
import { ClassRating } from './ClassRating';
import { SchoolGoalCard } from './SchoolGoalCard';

/** Цель школы и рейтинг классов у преподавателя. Пока в школе один класс, рейтинг не показывается */
export function TeacherSchoolPoints() {
  const [period, setPeriod] = useState<RatingPeriod>('week');
  const { data } = useLoad(() => fetchTeacherSchoolPoints(period), [period]);
  if (!data || (!data.goal && data.rating.length < 2)) return null;
  return (
    <div className="space-y-6">
      {data.goal && <SchoolGoalCard goal={data.goal} />}
      {data.rating.length > 1 && <ClassRating rows={data.rating} period={period} onPeriod={setPeriod} />}
    </div>
  );
}

/** Цель школы в кабинете ученика: без рейтинга, только общий счёт всех классов */
export function StudentSchoolGoal() {
  const { data } = useLoad(() => fetchStudentSchoolGoal(), []);
  return data?.goal ? <SchoolGoalCard goal={data.goal} /> : null;
}
