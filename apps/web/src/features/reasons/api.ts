import { api, type Reason } from '../../lib/api';

type ReasonDraft = Omit<Reason, 'id'>;

export const saveReasonOrder = (groupId: string, reasonIds: string[]) =>
  api('PUT', `/teacher/groups/${groupId}/reasons/order`, { reasonIds });

export const deleteReason = (reasonId: string) => api('DELETE', `/teacher/reasons/${reasonId}`);

export const createReason = (groupId: string, draft: ReasonDraft) => api('POST', `/teacher/groups/${groupId}/reasons`, draft);

export const updateReason = (reasonId: string, draft: ReasonDraft) => api('PATCH', `/teacher/reasons/${reasonId}`, draft);
