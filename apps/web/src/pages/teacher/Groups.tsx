import { GroupsList } from '../../features/groups';
import { StreamsSection } from '../../features/streams';

export function GroupsPage() {
  return (
    <div className="space-y-8">
      <GroupsList />
      <StreamsSection />
    </div>
  );
}
