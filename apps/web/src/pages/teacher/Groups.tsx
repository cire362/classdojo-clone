import { GroupsList } from '../../features/groups';
import { StreamsSection } from '../../features/streams';
import { MaterialsLink } from '../../features/materials';

export function GroupsPage() {
  return (
    <div className="space-y-8">
      <GroupsList />
      <StreamsSection />
      <MaterialsLink />
    </div>
  );
}
