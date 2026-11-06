import type { ReportReason } from '@heroes/shared';
import { api, type FeedPost, type Moderation } from '../../lib/api';

export type Target = 'post' | 'comment';

export const fetchModeration = (groupId: string) => api<Moderation>('GET', `/teacher/groups/${groupId}/moderation`);

/** Скрыть или показать; открытые жалобы на это закрываются. Ответ — обновлённые очередь и журнал */
export const setHidden = (groupId: string, target: Target, id: string, hidden: boolean) =>
  api<Moderation>('PUT', `/teacher/groups/${groupId}/moderation/${target}/${id}`, { hidden });

/** Жалоба родителя: path — адрес ленты ребёнка. post — null, если жалоба скрыла запись */
export const reportContent = (path: string, postId: string, body: { reason: ReportReason; note: string; commentId?: string }) =>
  api<{ post: FeedPost | null }>('POST', `${path}/${postId}/reports`, body);
