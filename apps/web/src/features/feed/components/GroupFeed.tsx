import { useState } from 'react';
import { useGroup } from '../../groups';
import { ModerationPanel } from '../../moderation';
import { Switch } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { setFeedComments } from '../api';
import { Feed } from './Feed';

/** Лента группы: объявления преподавателей для учеников и родителей */
export function GroupFeed() {
  const { data, setData } = useGroup();
  const toast = useToast();
  const { id, archivedAt, feedComments } = data.group;
  const archived = !!archivedAt;
  // Решение в панели жалоб меняет ленту, а скрытие или удаление в ленте — очередь и журнал
  const [feedVersion, setFeedVersion] = useState(0);
  const [panelVersion, setPanelVersion] = useState(0);

  async function toggle(on: boolean) {
    try {
      await setFeedComments(id, on);
      setData((current) => current && { ...current, group: { ...current.group, feedComments: on } });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {!archived && (
        <label className="flex cursor-pointer items-center gap-2">
          <Switch checked={feedComments} onChange={toggle} label="Комментарии родителей" />
          <span className="text-sm">Комментарии родителей</span>
        </label>
      )}
      <ModerationPanel groupId={id} version={panelVersion} onDecided={() => setFeedVersion((v) => v + 1)} />
      {/* Ключ заново загружает ленту: от настройки зависит, можно ли писать под записями */}
      <Feed
        key={String(feedComments)}
        path={`/teacher/groups/${id}/feed`}
        postTo={archived ? undefined : `/teacher/groups/${id}/feed`}
        noPhotoNames={data.students.filter((s) => s.noPhotos).map((s) => s.name)}
        readOnlyNote={archived ? 'Группа в архиве: новые объявления публиковать нельзя.' : undefined}
        moderation={{ groupId: id, onDecided: () => setPanelVersion((v) => v + 1) }}
        refreshKey={feedVersion}
      />
    </div>
  );
}
