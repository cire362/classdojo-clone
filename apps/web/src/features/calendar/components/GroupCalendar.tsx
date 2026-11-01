import { useGroup } from '../../groups';
import { Calendar } from './Calendar';

/** Календарь группы для преподавателя: в архиве только просмотр */
export function GroupCalendar() {
  const { data } = useGroup();
  return <Calendar path={`/teacher/groups/${data.group.id}/events`} editable={!data.group.archivedAt} />;
}
