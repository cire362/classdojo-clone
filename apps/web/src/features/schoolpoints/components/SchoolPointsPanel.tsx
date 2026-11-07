import { useState } from 'react';
import type { RatingPeriod } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchAdminSchoolPoints } from '../api';
import { ClassRating } from './ClassRating';
import { SchoolGoalEditor } from './SchoolGoalEditor';
import { SchoolReasons } from './SchoolReasons';

/** Баллы школы в панели администрации: цель всех классов, общие причины и рейтинг классов */
export function SchoolPointsPanel({ canEdit }: { canEdit: boolean }) {
  const [period, setPeriod] = useState<RatingPeriod>('week');
  const { data, error, reload, setData } = useLoad(() => fetchAdminSchoolPoints(period), [period]);
  return (
    <div className="max-w-3xl space-y-8">
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (
        <>
          <SchoolGoalEditor goal={data.goal} canEdit={canEdit} onChange={(goal) => setData({ ...data, goal })} />
          <SchoolReasons canEdit={canEdit} />
          <ClassRating rows={data.rating} period={period} onPeriod={setPeriod} />
        </>
      )}
    </div>
  );
}
