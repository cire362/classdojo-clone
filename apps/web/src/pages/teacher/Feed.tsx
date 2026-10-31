import { Feed } from '../../components/Feed';
import { useGroup } from '../../features/groups';

/** Лента группы: объявления преподавателей для учеников и родителей */
export function GroupFeedPage() {
  const { data } = useGroup();
  const archived = !!data.group.archivedAt;
  return (
    <Feed
      path={`/teacher/groups/${data.group.id}/feed`}
      postTo={archived ? undefined : `/teacher/groups/${data.group.id}/feed`}
      readOnlyNote={archived ? 'Группа в архиве: новые объявления публиковать нельзя.' : undefined}
    />
  );
}
